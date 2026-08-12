import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.Rest;

@service(#{ title: "Booking Service API" })
@server("http://localhost:8000", "Local backend")
namespace BookingService;

// ═══════════════════════ Common models ═══════════════════════

@doc("""
Шаблон встречи, на которую записывается гость.
Принадлежит единственному владельцу календаря (id владельца = 1, создаётся сидом).
""")
@example(#{ id: 1, name: "Встреча 30 минут", description: "Базовый тип события для бронирования.", duration_minutes: 30 })
model EventType {
  id: int64;

  @minLength(1)
  @maxLength(200)
  name: string;

  description: string;

  @doc("Длительность встречи в минутах. В v1 допускается только значение 30.")
  duration_minutes: int32;
}

enum SlotStatus {
  free,
  busy,
}

@doc("""
Слот в сетке 30 минут на конкретную календарную дату.
Время хранится в UTC ISO 8601 с offset; локальное отображение — Europe/Moscow.
""")
model Slot {
  @doc("Начало слота, UTC ISO 8601 с offset.")
  start_at: offsetDateTime;

  @doc("Конец слота, UTC ISO 8601 с offset. Всегда start_at + duration_minutes (30 минут в v1).")
  end_at: offsetDateTime;

  status: SlotStatus;
}

@doc("Запрос на создание бронирования.")
model BookingRequest {
  @minLength(1)
  @maxLength(200)
  guest_name: string;

  @format("email")
  guest_email: string;

  @doc("Желаемое начало встречи, UTC ISO 8601 с offset.")
  start_at: offsetDateTime;
}

@doc("""
Подтверждение успешно созданного бронирования. Единый источник правды
для гостя — отдельного эндпоинта для повторного просмотра нет.
""")
model BookingConfirmation {
  id: int64;

  @doc("Развёрнутый тип события, по которому оформлена запись.")
  event_type: EventType;

  guest_name: string;
  guest_email: string;

  start_at: offsetDateTime;
  end_at: offsetDateTime;

  created_at: offsetDateTime;
}

@doc("""
Элемент списка бронирований, который видит владелец календаря в админке.
Один тип события в списке не разворачивается — хватает id и name
для отрисовки таблицы предстоящих встреч.
""")
model AdminBooking {
  id: int64;
  event_type_id: int64;
  event_type_name: string;

  guest_name: string;
  guest_email: string;

  start_at: offsetDateTime;
  end_at: offsetDateTime;
  created_at: offsetDateTime;
}

@doc("""
Тело для создания и обновления типа события владельцем.
duration_minutes в v1 строго равен 30, иначе сервер вернёт 422 invalid_duration.
""")
model EventTypeInput {
  @minLength(1)
  @maxLength(200)
  name: string;

  description: string;

  duration_minutes: int32;
}

// ═══════════════════════ Errors ═══════════════════════

enum ErrorCode {
  validation_failed,
  slot_outside_window,
  slot_outside_hours,
  slot_in_past,
  slot_taken,
  event_type_not_found,
  booking_not_found,
  invalid_duration,
  internal_error,
}

@doc("Описание ошибки валидации по конкретному полю запроса.")
model FieldError {
  field: string;
  messages: string[];
}

@doc("""
Тело ответа с ошибкой.
details — массив ошибок по полям запроса. Присутствует в основном для 422,
но поле опционально для единообразия.
""")
model ErrorBody {
  code: ErrorCode;
  message: string;
  details?: FieldError[];
}

@error
@doc("Ресурс не найден (например, неизвестный id типа события).")
model NotFoundError {
  @statusCode status: 404;
  error: ErrorBody;
}

@error
@doc("""
Ошибка валидации запроса или нарушение бизнес-правила занятости/окна:
- validation_failed — поле запроса не прошло проверку (формат email, длина имени и т.п.);
- slot_outside_window — выбранная дата вне 14-дневного окна;
- slot_outside_hours — время вне 06:00–22:00 MSK;
- slot_in_past — start_at уже в прошлом;
- invalid_duration — duration_minutes ≠ 30.
""")
model ValidationError {
  @statusCode status: 422;
  error: ErrorBody;
}

@error
@doc("Конфликт занятости: на этот start_at уже существует бронирование.")
model SlotConflictError {
  @statusCode status: 409;
  error: ErrorBody;
}

// ═══════════════════════ Public: guest routes ═══════════════════════

@route("/api/event-types")
namespace PublicEventTypes {
  @get
  @summary("Публичный каталог типов событий")
  op list(): EventType[];

  @get
  @route("/{id}")
  @summary("Получить тип события по id")
  op get(@path id: int64): EventType | NotFoundError;

  @get
  @route("/{id}/slots")
  @summary("""
Сетка слотов на конкретный день.
Возвращаются ВСЕ 30-минутные слоты рабочего дня (06:00–22:00 MSK),
с пометкой free/busy. Серверная проверка:
- дата входит в 14-дневное окно (сегодня..сегодня+13), иначе slot_outside_window;
- start_at >= текущего момента, иначе слот помечается busy;
- на start_at нет существующего бронирования, иначе busy.
""")
  op slots(
    @path id: int64,
    @query("date")
    @doc("Дата в формате YYYY-MM-DD. Должна быть в окне сегодня..сегодня+13.")
    date: string,
  ): Slot[] | NotFoundError | ValidationError;

  @post
  @route("/{id}/bookings")
  @summary("Создать бронирование и вернуть подтверждение. Атомарная проверка занятости start_at.")
  op createBooking(
    @path id: int64,
    @body request: BookingRequest,
  ): BookingConfirmation | NotFoundError | ValidationError | SlotConflictError;
}

// ═══════════════════════ Owner: admin routes ═══════════════════════
//
// В v1 эти роуты НЕ защищены авторизацией в коде — в системе один предзаданный
// владелец. Разделение доступа — инфраструктурное (отдельный admin-фронтенд,
// отдельный reverse-proxy location и т.п.). Контракт фиксирует только
// префикс URL и тот факт, что это «внутренние» роуты.

@route("/api/owner/event-types")
namespace OwnerEventTypes {
  @get
  @summary("Список типов событий владельца")
  op list(): EventType[];

  @post
  @summary("Создать тип события. duration_minutes должен быть равен 30.")
  op create(@body input: EventTypeInput): EventType | ValidationError;

  @get
  @route("/{id}")
  @summary("Получить свой тип события для редактирования")
  op get(@path id: int64): EventType | NotFoundError;

  @put
  @route("/{id}")
  @summary("Полное обновление типа события (id остаётся прежним, duration_minutes — 30).")
  op update(
    @path id: int64,
    @body input: EventTypeInput,
  ): EventType | NotFoundError | ValidationError;

  @delete
  @route("/{id}")
  @summary("Удалить тип события. Возвращает 204 при успехе. Удаление не отменяет уже созданные бронирования.")
  op delete(@path id: int64): void | NotFoundError;
}

@route("/api/owner/bookings")
namespace OwnerBookings {
  @get
  @summary("""
Список предстоящих бронирований владельца.
Возвращает записи со start_at >= текущего момента по всем типам событий,
отсортированные по start_at по возрастанию.
""")
  op list(): AdminBooking[];
}
