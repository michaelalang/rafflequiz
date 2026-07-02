const socket = io();

// UI Elements
const playerCountEl = document.getElementById('player-count');
const startGameBtn = document.getElementById('start-game-btn');
const nextQuestionBtn = document.getElementById('next-question-btn');
const leaderboardBody = document.getElementById('leaderboard-body');
const questionsListEl = document.getElementById('questions-list');
const quizNameInput = document.getElementById('quiz-name-input');

// Editor Elements
const editorTitle = document.getElementById('editor-title');
const saveQuestionBtn = document.getElementById('save-question-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const newQText = document.getElementById('new-q-text');
const optionsContainer = document.getElementById('dynamic-options-container');
const addOptionBtn = document.getElementById('add-option-btn');

let editingIndex = null;
let serverQuestions = [];

socket.on('update_player_count', (count) => { playerCountEl.textContent = count; });

startGameBtn.addEventListener('click', () => {
    if(confirm('Start or Replay the game? This will reset all current scores.')) {
        socket.emit('admin_start_game');
        
        // Pass the typed name dynamically to the lobby
        const quizName = encodeURIComponent(quizNameInput.value.trim() || "Red Hat Quiz");
        window.open(`/lobby.html?quizName=${quizName}`, 'QuizLobby', 'width=1000,height=800,menubar=no,toolbar=no,location=no,status=no');
    }
});

nextQuestionBtn.addEventListener('click', () => {
    socket.emit('admin_next_question');
});

// --- Dynamic Options Logic ---
function createOptionRow(value = "", isCorrect = false) {
    const row = document.createElement('div');
    row.className = 'dynamic-option-row';
    row.innerHTML = `
        <label class="checkbox-label" style="flex-shrink: 0;" title="Mark as correct">
            <input type="checkbox" class="opt-checkbox" ${isCorrect ? 'checked' : ''}>
        </label>
        <input class="pf-c-form-control opt-input" type="text" placeholder="Enter option text..." value="${value}" style="flex-grow: 1;" />
        <button class="pf-c-button pf-m-secondary pf-m-small remove-opt-btn" style="flex-shrink: 0; padding: 0.25rem 0.5rem;">X</button>
    `;
    row.querySelector('.remove-opt-btn').addEventListener('click', () => {
        if (optionsContainer.children.length > 2) row.remove();
        else alert("A question must have at least 2 options.");
    });
    optionsContainer.appendChild(row);
}

addOptionBtn.addEventListener('click', () => createOptionRow());

// --- Editor State Logic ---
socket.on('update_questions_list', (questions) => {
    serverQuestions = questions;
    questionsListEl.innerHTML = '';
    questions.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'question-list-item';
        div.innerHTML = `
            <div style="flex: 1; margin-right: 1rem;"><strong>Q${index + 1}:</strong> ${q.text}</div>
            <button class="pf-c-button pf-m-secondary pf-m-small edit-btn" data-index="${index}">Edit</button>
        `;
        questionsListEl.appendChild(div);
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            loadQuestionIntoEditor(parseInt(e.target.getAttribute('data-index')));
        });
    });
});

function loadQuestionIntoEditor(index) {
    editingIndex = index;
    const q = serverQuestions[index];
    editorTitle.textContent = `Editing Question ${index + 1}`;
    cancelEditBtn.style.display = 'inline-block';
    
    newQText.value = q.text;
    optionsContainer.innerHTML = ''; 
    q.options.forEach((optText, optIndex) => {
        createOptionRow(optText, q.correct.includes(optIndex));
    });
}

function resetEditor() {
    editingIndex = null;
    editorTitle.textContent = 'Add Question';
    cancelEditBtn.style.display = 'none';
    newQText.value = '';
    optionsContainer.innerHTML = ''; 
    for(let i=0; i<4; i++) createOptionRow();
}

cancelEditBtn.addEventListener('click', resetEditor);

saveQuestionBtn.addEventListener('click', () => {
    const text = newQText.value.trim();
    const options = [];
    const correct = [];
    let hasEmptyOption = false;

    optionsContainer.querySelectorAll('.dynamic-option-row').forEach((row, index) => {
        const optText = row.querySelector('.opt-input').value.trim();
        if (optText === "") hasEmptyOption = true;
        options.push(optText);
        if (row.querySelector('.opt-checkbox').checked) correct.push(index);
    });

    if (!text || hasEmptyOption) return alert("Fill out the question text and all option fields.");
    if (correct.length === 0) return alert("Select at least one correct answer.");

    socket.emit('admin_save_question', { index: editingIndex, question: { text, options, correct } });
    resetEditor();
});

resetEditor();

// --- Game Flow Logic ---
socket.on('question_ended', (data) => updateLeaderboard(data.leaderboard));
socket.on('game_over', (leaderboard) => updateLeaderboard(leaderboard));

function updateLeaderboard(leaderboard) {
    leaderboardBody.innerHTML = '';
    leaderboard.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td data-label="Name">${p.name}</td><td data-label="Score">${p.score}</td><td data-label="Total Time (s)">${p.totalTime.toFixed(2)}</td>`;
        leaderboardBody.appendChild(tr);
    });
}
