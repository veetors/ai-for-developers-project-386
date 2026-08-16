# Локальный enforcement Conventional Commits через commitlint + husky

## 🎯 Проблема
Репозиторий уже использовал стиль Conventional Commits в сообщениях коммитов (`feat(backend): …`, `feat(frontend): …`), но проверка соблюдалась только «на глаз». Необходимо автоматически блокировать коммиты, не соответствующие [https://www.conventionalcommits.org/en/v1.0.0/](https://www.conventionalcommits.org/en/v1.0.0/), оставив ограничение строго локальным (без CI-проверок).

## ✅ Решение
Добавлен root-уровневый Node-инструментарий, который на этапе Git-хука `commit-msg` запускает `commitlint` со стандартным пресетом `@commitlint/config-conventional`:

- Husky v9 перенастроен: `core.hooksPath` указывает на встроенный роутер `.husky/_/`, а сами пользовательские хуки лежат рядом в `.husky/`. При коммите срабатывает `.husky/_/commit-msg` → `.husky/commit-msg` → `npx --no -- commitlint --edit "$1"`.
- `commitlint.config.js` расширяет `@commitlint/config-conventional` — это эквивалент правил Conventional Commits (feat/fix/chore/refactor/perf/test/docs/build/ci/revert/style, опциональный scope, нижний регистр, и т.д.).
- Merge-коммиты игнорируются стандартными правилами commitlint (`/^(Merge pull request|Merge branch|Merge tag)/`), что соответствует нашему Hexlet-процессу со squash- и merge-PR.
- `package.json` содержит `prepare: husky`, поэтому после `npm install` хуки автоматически устанавливаются.
- `.husky/_/` (внутренние скрипты husky) исключён из git через `.gitignore`.

## 📝 Изменённые файлы
1. `package.json` — новый: приватный корневой пакет с devDependencies `@commitlint/cli`, `@commitlint/config-conventional`, `husky`, скрипт `prepare`.
2. `commitlint.config.js` — новый: `module.exports = { extends: ['@commitlint/config-conventional'] }`.
3. `.husky/commit-msg` — новый: запускает `npx --no -- commitlint --edit "$1"` при коммите.
4. `.gitignore` — добавлены `node_modules/` и `.husky/_/` для корня.
5. `package-lock.json` — сгенерирован автоматически при `npm install`.

## 🚀 Как протестировать
1. Выполнить `npm install` в корне (должен отработать `prepare: husky`, активирующий хуки).
2. Сделать «плохой» коммит:
   ```sh
   git commit --allow-empty -m "Add some file"
   ```
   Ожидаемый отказ: `husky - commit-msg script failed (code 1)` + ошибки commitlint (`type may not be empty`, `subject may not be empty`).
3. Сделать «правильный» коммит:
   ```sh
   git commit --allow-empty -m "chore: test hook routing"
   ```
   Ожидаемый успех: коммит создан.
4. Merge-коммит проходит без проверки:
   ```sh
   printf 'Merge pull request #2 from veetors/step-4-backend\n' | npx commitlint
   ```
   `EXIT=0`.

## ⚙️ Важные детали
- Версии закреплены majors: `@commitlint/*@^19`, `husky@^9` — это актуальные стабильные.
- Хук работает только локально. В CI не добавлен workflow — это соответствует решению пользователя.
- `.husky/` коммитится в репозиторий; внутренняя папка `.husky/_/` husky добавляет в `.gitignore` (мы продублировали её в корневом `.gitignore` для надёжности).
- В корневом `package.json` нет `type: module`, поэтому используется CommonJS-синтаксис в `commitlint.config.js`.
- Корневой инструментарий не конфликтует с существующими `frontend/package.json` (Vite/React) и `spec/package.json` (TypeSpec) — это отдельные деревья со своими `node_modules/`.

## 🎉 Итог
Теперь любые локальные коммиты автоматически приводятся в соответствие со спецификацией Conventional Commits v1.0.0. Merge/PR-коммиты проходят без изменений.
