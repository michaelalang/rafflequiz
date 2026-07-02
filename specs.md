## Raffle Quiz Application Specification (spec.md)

### 1. Overview
The Raffle Quiz Application is a lightweight, real-time, mobile-responsive web application designed for live event quizzes. It allows a central "Quiz Master" to present a lobby, dynamically create questions, and push them to connected participants simultaneously. Winners are determined by calculating the highest score combined with the lowest total answer time, including time penalties for changing answers.

### 2. Architecture & Technology Stack
* **Backend:** Node.js, Express.js
* **Communication:** WebSockets (Socket.IO) for bi-directional, real-time data flow.
* **Frontend:** HTML5, Vanilla JavaScript.
* **UI Framework & Design:** PatternFly 6 CSS via CDN, styled with custom Red Hat corporate branding (Dark charcoal backgrounds, `#EE0000` accents).
    * **Participant Client View:** Purpose-built, mobile-first design using 100% full-screen vertical layout flexbox constraints to optimize touchscreen targets.
    * **Admin Master Dashboard View:** Expanded inputs engineered for high density text readability on larger viewports.
* **Libraries:** `qrcode.js` (Client-side dynamic QR code generation).
* **State Management:** In-memory variables on the Node.js server. **No persistent database** is used to ensure maximum portability.
* **Target Platform:** Red Hat OpenShift (Containerized via Dockerfile, running as a non-root user on port 8080).

### 3. User Roles & Views

* **Participant (Mobile-Only Client - `/`):** Connects to the main interface, registers with a display name (supports "Enter" key submission), receives real-time questions, and submits answers. Features massive, touch-optimized vertical control buttons. Players are insulated from mid-game feedback to preserve suspense, but are treated to a full player scrolling leaderboard upon completion.
* **Quiz Master (Admin Dashboard - `/admin.html`):** Connects to a hidden/secure dashboard. Controls the game flow, manages the live question pool (adding, editing, and defining multiple correct answers), names the event, and monitors the live leaderboard (which updates after every question). The Quiz Master can also push a mid-game leaderboard to the big screen at any time. Input environments leverage vertical scrolling textareas to facilitate long question formats without layout fragmentation.
* **Audience/Presenter (Lobby Screen - `/lobby.html` / Big Screen - `/screen.html`):** Presentation views opened by the Quiz Master. Displays the dynamic event name, join URL, QR code, and a live-updating list of connected participants. The Big Screen displays live questions, highlights correct answers for 10 seconds post-question, and presents the leaderboards.

### 4. Core Game Mechanics

* **Question Lifecycle:** Questions are strictly controlled by the Quiz Master. Participants cannot proceed until the Quiz Master pushes the next question.
* **Dynamic Question Pool:** The Quiz Master can add questions with 2 or more custom options. Questions support **multiple correct answers**.
* **Configurable Timer:** Each question has a strict server-enforced time limit (default: 15 seconds).
* **Scoring:** 1 point is awarded for each completely correct answer (if multiple options are marked correct, the user must select *exactly* those options).
* **Time Tracking & Penalties:** * The server logs the exact timestamp when a question is broadcast.
    * When a user selects (or toggles) an answer, the delta time is recorded.
    * **Penalty Mechanic:** If a user changes their answer before the timer expires, the time taken to make the change is *added* to their cumulative time for that question.
* **Suspense & Leaderboard Logic:** * Players are kept in the dark regarding their standing mid-game on their mobile devices, maintaining game-flow suspense. However, the Quiz Master sees live score updates on the admin dashboard after each question.
    * **Big Screen Answer Reveal:** On the main presentation screen, correct answers are clearly highlighted in green for 10 seconds at the end of each question before transitioning to a waiting state.
    * **Mid-Game Standings:** The Quiz Master can manually trigger the leaderboard to appear on the big screen at any point between questions.
    * The game automatically calculates the final scoreboard 5 seconds after the final question concludes.
    * Players are ranked primarily in descending order of their Score, and secondarily in ascending order of their Total Answer Time (lower time = higher rank).
    * **Persistent Game Over State:** Upon game conclusion, the final dashboard view is transmitted to *all* players and remains visible for any late-joiners or page refreshes until a new game is started. Every connected participant can scroll through the list, with their own row highlighted in Red Hat red (`#EE0000`). Top 3 players receive medal icons (🥇, 🥈, 🥉).
* **Replayability:** The Quiz Master can click "Start/Replay Game" at any time to clear current player scores and timers and run through the existing question pool again.

### 5. WebSocket Event Dictionary

The application relies on the following Socket.IO events to sync the state between the server, the Quiz Master, the Lobby, and the Participants.

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `join_game` | Client -> Server | `String` (Name) | Participant registers for the session. |
| `joined_successfully` | Server -> Client | `String` (Status) | Confirms registration and moves UI to waiting screen. |
| `update_player_count` | Server -> Admin | `Integer` | Updates Quiz Master with total active connections. |
| `waiting_players_update` | Server -> All | `Array` (Names) | Broadcasts list of registered player names to Lobby and waiting participants. |
| `update_questions_list` | Server -> Admin | `Array` (Questions) | Syncs the dynamic question pool with the Admin editor. |
| `admin_save_question` | Admin -> Server | `Object` (Question data) | Adds a new question or updates an existing one at a specific index. |
| `admin_start_game` | Admin -> Server | None | Signals the server to reset scores, timers, and prepare the first question. |
| `game_started` | Server -> Client | None | Broadcasts to participants that the game is initializing. |
| `admin_next_question` | Admin -> Server | None | Quiz master triggers the next question in the array. |
| `admin_show_leaderboard` | Admin -> Server | None | Quiz master triggers the mid-game leaderboard display. |
| `show_midgame_leaderboard`| Server -> All | `Array` (Leaderboard) | Broadcasts current standings to clients/screens for mid-game review. |
| `new_question` | Server -> Client | `Object` (Question data) | Broadcasts question text, options, and time limit. |
| `submit_answer` | Client -> Server | `Array` (Indices) | Participant sends their selected option indices. |
| `question_ended` | Server -> All | `Object` (Result data) | Broadcasts state closure; transitions clients to the silent waiting interface. |
| `game_over` | Server -> All | `Array` (Leaderboard) | Triggered automatically after final question. Broadcasts complete final rankings list to all clients. |

### 6. Deployment Considerations (OpenShift)

* **Replica Constraint:** Because the application relies on local in-memory state and WebSockets without a Redis backplane, the deployment **must be scaled to exactly 1 pod/replica**.
* **Port Configuration:** The container exposes port `8080` to comply with OpenShift's default restricted Security Context Constraints (SCC), which prevent binding to privileged ports (like 80 or 443).
* **Resource Limits:** The application is highly lightweight. A baseline of `100m` CPU and `128Mi` Memory is sufficient for standard operation, with limits set to `500m` CPU and `512Mi` Memory.
* **Ephemeral Data:** Restarting the pod will clear all current scores, connected users, and the customized question pool.
