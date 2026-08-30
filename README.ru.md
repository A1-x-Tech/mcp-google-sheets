# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Sheets MCP

[English](./README.md) | **Русский**

[![npm](https://img.shields.io/npm/v/%40a1-x-tech%2Fmcp-google-sheets)](https://www.npmjs.com/package/@a1-x-tech/mcp-google-sheets)
[![CI](https://github.com/A1-x-Tech/mcp-google-sheets/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-sheets/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-sheets/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-sheets)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Sheets MCP** позволяет AI-приложению работать с Google Sheets на естественном языке. Можно найти таблицу, прочитать данные, записать и дописать строки, настроить листы и форматирование, построить диаграммы и поделиться результатом.

Сервер работает с Google Sheets API через ваш Google-аккаунт. Он разделяет чтение и запись, явно помечает разрушительные операции и честно показывает ограничения Sheets API, а не создаёт впечатление, что с таблицей можно сделать всё.

- **20 инструментов.** Поиск и создание таблиц, чтение и запись диапазонов, управление листами, форматированием, проверкой данных, защищёнными диапазонами, условным форматированием, структурированными таблицами, диаграммами и доступом.
- **Осознанная запись.** Запись никогда не повторяется после неопределённой ошибки — повтор `append` продублировал бы строки, — а разрушительные инструменты помечены, чтобы AI-клиент мог сначала спросить.
- **Только Sheets.** Drive — внутренняя зависимость лишь для поиска таблиц и управления доступом; отдельного Drive-инструмента нет, и `raw_request` до Drive не дотягивается.
- **Минимальные scope Google.** `spreadsheets` покрывает каждый Sheets-инструмент; scope Drive нужен только для поиска таблиц и управления доступом.

Начните с запроса, который только читает данные:

> Найди таблицу с квартальным бюджетом и кратко расскажи, что на каждом её листе.

[Подключить сервер](#быстрый-старт) · [Посмотреть сценарии](#что-можно-поручить) · [Открыть техническую документацию](#техническая-документация)

---

## Увидеть работу за минуту

> **Вы:** Покажи структуру таблицы с отчётом о продажах: листы, их размеры и закреплённые строки.
>
> **Ассистент:** Показывает листы, их размеры, закреплённые заголовки и объекты на них. Ничего не меняется.
>
> **Вы:** Подготовь лист «Март» как копию «Февраля» и очисти цифры, сохранив оформление.
>
> **Ассистент:** Показывает план — продублировать лист, переименовать его и очистить диапазоны с данными — и запрашивает подтверждение перед любым изменением.
>
> **Вы:** Подтверждаю.
>
> **Ассистент:** Дублирует лист и очищает значения. Форматирование, проверка данных и закреплённые строки остаются.

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Что можно поручить](#что-можно-поручить)
- [Как меняется таблица](#как-меняется-таблица)
- [Что может измениться](#что-может-измениться)
- [Как получить доступ](#как-получить-доступ)
- [Конфигурация](#конфигурация)
- [Данные, лимиты и работа в фоне](#данные-лимиты-и-работа-в-фоне)
- [Техническая документация](#техническая-документация)
- [Поддержка](#поддержка)

## Быстрый старт

Нужны Node.js 20+, Google-аккаунт и OAuth-данные из проекта Google Cloud с включённым Google Sheets API.

1. [Подготовьте Google OAuth-доступ](#как-получить-доступ).
2. Добавьте сервер в AI-приложение.
3. Отправьте запрос, который только читает данные.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**В приложении:** откройте **Settings → MCP servers**, нажмите **Add server**, выберите **STDIO**, укажите команду `npx -y @a1-x-tech/mcp-google-sheets@latest` и переменные окружения `GOOGLE_SHEETS_CLIENT_ID`, `GOOGLE_SHEETS_CLIENT_SECRET`, `GOOGLE_SHEETS_REFRESH_TOKEN`, затем нажмите **Save**, потом **Restart**.

**В командной строке:**

```bash
codex mcp add google-sheets \
  --env GOOGLE_SHEETS_CLIENT_ID=your_client_id \
  --env GOOGLE_SHEETS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_SHEETS_REFRESH_TOKEN=your_refresh_token \
  -- npx -y @a1-x-tech/mcp-google-sheets@latest
```

```bash
codex mcp list
```

[Документация Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

</details>

<details>
<summary><strong>Claude Code</strong></summary>

<br>

```bash
claude mcp add \
  --env GOOGLE_SHEETS_CLIENT_ID=your_client_id \
  --env GOOGLE_SHEETS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_SHEETS_REFRESH_TOKEN=your_refresh_token \
  --transport stdio --scope user google-sheets \
  -- npx -y @a1-x-tech/mcp-google-sheets@latest
```

```bash
claude mcp list
```

[Документация Claude Code MCP](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

Актуальный официальный путь — **Settings → Extensions**. Для пользовательского desktop extension откройте **Advanced settings → Extension Developer → Install Extension…**, выберите файл `.mcpb` и следуйте подсказкам.

Этот репозиторий сейчас публикует npm-пакет со stdio и пока не содержит `.mcpb`. Поэтому используйте приведённый ниже JSON stdio-конфиг как fallback только в сборках Claude Desktop, где ещё поддерживается локальная конфигурация:

```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-sheets@latest"],
      "env": {
        "GOOGLE_SHEETS_CLIENT_ID": "your_client_id",
        "GOOGLE_SHEETS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_SHEETS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

В таких сборках сохраните его в `~/Library/Application Support/Claude/claude_desktop_config.json` на macOS или `%APPDATA%\Claude\claude_desktop_config.json` на Windows.

[Документация Claude Desktop MCP](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Добавьте в `~/.cursor/mcp.json` на macOS/Linux или `%USERPROFILE%\.cursor\mcp.json` на Windows:

```json
{
  "mcpServers": {
    "google-sheets": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-sheets@latest"],
      "env": {
        "GOOGLE_SHEETS_CLIENT_ID": "your_client_id",
        "GOOGLE_SHEETS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_SHEETS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

[Документация Cursor MCP](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Запустите **MCP: Open User Configuration** и добавьте:

```json
{
  "servers": {
    "google-sheets": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-sheets@latest"],
      "env": {
        "GOOGLE_SHEETS_CLIENT_ID": "${input:sheets_client_id}",
        "GOOGLE_SHEETS_CLIENT_SECRET": "${input:sheets_client_secret}",
        "GOOGLE_SHEETS_REFRESH_TOKEN": "${input:sheets_refresh_token}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "sheets_client_id", "description": "Google OAuth client ID" },
    { "type": "promptString", "id": "sheets_client_secret", "description": "Google OAuth client secret", "password": true },
    { "type": "promptString", "id": "sheets_refresh_token", "description": "Google OAuth refresh token", "password": true }
  ]
}
```

Проверьте сервер командой **MCP: List Servers**.

[Документация VS Code MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## Что можно поручить

### Найти и прочитать данные

- Найди самую свежую таблицу со словом «бюджет» в названии и покажи её структуру.
- Прочитай `'Q3'!A1:F50` и суммируй итоги.
- Покажи формулы, по которым считается лист «Итоги».

### Обновить цифры

- Запиши эту таблицу в `Sheet1!A1` вместе с формулами.
- Добавь сегодняшние показатели новой строкой журнала.
- Обнови несколько диапазонов одним пакетом или очисти черновой диапазон, сохранив его оформление.

### Оформить и показать

- Добавь лист «Март», закрепи строку заголовка и выдели её жирным.
- Подсвети отрицательные суммы красным условным форматом и добавь границы.
- Построй столбчатую диаграмму выручки по месяцам на отдельном листе.
- Преврати данные в структурированную таблицу и добавь выпадающий список через проверку данных.

### Защитить и поделиться

- Защити строку итогов, чтобы её мог менять только я.
- Дай коллеге право редактирования, а остальным — только чтение.
- Покажи, у кого сейчас есть доступ к файлу.

## Как меняется таблица

1. Инструменты значений адресуют ячейки в **нотации A1** (`'Имя листа'!A1:C10`); структурные инструменты (листы, форматирование, правила, таблицы, диаграммы) адресуют числовой **sheetId** и индексы с отсчётом от нуля. Идентификаторы даёт `get_spreadsheet` — названия листов адресами не являются.
2. Запись **перезаписывает** свой диапазон; `append_values` добавляет строки после последней строки данных; ячейка `null` пропускается, а не очищается.
3. `clear_values` очищает значения и формулы, но сохраняет форматирование, проверку данных, заметки и объединения. Отмены через API нет — удаление листа, строк или столбцов уничтожает их данные.
4. Пакетные инструменты переносят несколько диапазонов или запросов одним вызовом и считаются в квоте один раз; `batchUpdate` атомарен — применяются все его запросы или ни один.

У части возможностей таблиц нет отдельного инструмента: объединённые ячейки, именованные диапазоны, чередование цветов, фильтры, срезы, поиск с заменой и градиентные правила условного форматирования доступны через `raw_request`, который ограничен доменом Sheets API. Новая таблица создаётся в корне My Drive — перенос в папку сервер не покрывает, а `manage_permissions` не передаёт владение файлом.

## Что может измениться

| Операция | Что происходит | Граница подтверждения |
|---|---|---|
| Чтение метаданных и значений | Читает структуру и ячейки | Ничего не меняет |
| Создание таблицы | Добавляет файл в My Drive | Меняет Google Sheets |
| Запись, пакетная запись или добавление значений | Перезаписывает ячейки или добавляет строки | Меняет таблицу |
| Форматирование, закрепление, границы, строки и столбцы, проверка данных, правила, таблицы, диаграммы | Меняет оформление, структуру и правила | Меняет таблицу |
| Очистка значений, удаление листа, строк или столбцов | Удаляет данные без отмены через API | Разрушительно |
| Управление защищёнными диапазонами и доступом | Меняет, кто может открывать и редактировать файл | Меняет доступ |
| Технический запрос API | Может вызвать метод API без отдельного инструмента | Потенциально разрушительно |

Как AI-приложение просит подтверждение, определяет само приложение. Сервер помечает операции чтения, записи и удаления, чтобы оно отличило проверку от рабочего изменения.

## Как получить доступ

Для редактирования таблиц Google Sheets требует OAuth 2.0: одного API-ключа недостаточно.

1. Создайте или выберите проект Google Cloud и включите **Google Sheets API**. Включите также **Google Drive API**, если нужны поиск таблиц и управление доступом.
2. Настройте OAuth consent screen и создайте OAuth-клиент типа **Desktop app**.
3. Авторизуйте Google-аккаунт, который владеет таблицами или может их редактировать. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) поможет получить refresh token, если включить **Use your own OAuth credentials**.
4. Запросите минимальный scope:

   ```text
   https://www.googleapis.com/auth/spreadsheets
   ```

   Он покрывает каждый Sheets-инструмент. Дополнительный scope Drive нужен только `search_spreadsheets` и `manage_permissions`: `https://www.googleapis.com/auth/drive`, либо `drive.readonly` только для поиска, либо `drive.file` для файлов, созданных через это приложение.

Refresh token OAuth-приложения в режиме Testing может истечь через семь дней. Для долгого доступа опубликуйте OAuth-приложение или используйте Internal-приложение в домене Workspace. Храните client secret и refresh token как пароли.

## Конфигурация

| Переменная | Обязательна | Описание |
|---|---|---|
| `GOOGLE_SHEETS_CLIENT_ID` | Да* | OAuth client ID. |
| `GOOGLE_SHEETS_CLIENT_SECRET` | Да* | OAuth client secret. |
| `GOOGLE_SHEETS_REFRESH_TOKEN` | Да* | OAuth refresh token. |
| `GOOGLE_SHEETS_ACCESS_TOKEN` | Да* | Короткоживущая (~1 ч) альтернатива OAuth-тройке. |
| `GOOGLE_SHEETS_API_BASE` | Нет | Переопределяет базовый URL Google Sheets API. |
| `GOOGLE_SHEETS_TIMEOUT_MS` | Нет | Тайм-аут одного запроса; по умолчанию `60000` мс. |
| `GOOGLE_SHEETS_MAX_RETRIES` | Нет | Повторы временных ошибок; по умолчанию `3`. |

\* Передайте OAuth-тройку или access token. Без учётных данных сервер всё равно запустится и покажет инструменты; первый вызов назовёт переменные, которые нужно задать.

## Данные, лимиты и работа в фоне

- **Запросы идут в Google.** Локальный сервер обновляет OAuth-токены Google и вызывает Sheets API, а для поиска таблиц и управления доступом — Drive API. Анонимная телеметрия содержит ID установки, версию пакета, версии AI-клиента и платформы и имена инструментов — но не OAuth-токены, данные таблиц, аргументы или промпты. Чтобы отключить её, задайте `ASKADS_TELEMETRY=0`.
- **У Google есть поминутные квоты.** Документированные лимиты: 300 чтений и 300 записей в минуту на проект и по 60 на пользователя; пакетный вызов считается один раз, сколько бы диапазонов или запросов он ни нёс. В одной таблице не больше 10 000 000 ячеек. При `429` сервер использует задержку; чтение также повторяется после сетевых и `5xx` ошибок, а запись после неопределённой ошибки не повторяется.
- **Постоянного опроса нет.** Сервер работает только при вызове. Если AI-приложение поддерживает задания по расписанию, оно может периодически проверять таблицу.

## Техническая документация

- [Каталог MCP-возможностей](./docs/capabilities/index.md) — страницы по пользовательским задачам для каждого инструмента.
- [Все инструменты и параметры](./docs/TOOLS.md)
- [Документация по разработке](./docs/DEVELOPMENT.md)
- [Документация по публикации](./docs/PUBLISHING.md)
- [Справочник Google Sheets API](https://developers.google.com/sheets/api)

## Поддержка

Нашли ошибку или не хватает сценария? [Создайте issue](https://github.com/A1-x-Tech/mcp-google-sheets/issues) или напишите в [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  Вы дочитали до конца!
</p>
