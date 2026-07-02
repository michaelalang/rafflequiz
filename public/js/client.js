const socket = io();

// UI Elements
const screens = {
    login: document.getElementById('login-screen'),
    waiting: document.getElementById('waiting-screen'),
    question: document.getElementById('question-screen'),
    result: document.getElementById('result-screen')
};

const joinBtn = document.getElementById('join-btn');
const usernameInput = document.getElementById('username');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const timerDisplay = document.getElementById('timer-display');
const resultTitle = document.getElementById('result-title');
const resultText = document.getElementById('result-text');
const myScoreDisplay = document.getElementById('my-score-display');
const waitingPlayersList = document.getElementById('waiting-players-list');

let localTimer;
let selectedOptions = []; 
let myName = ""; 

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

function attemptJoin() {
    const name = usernameInput.value.trim();
    if (name) {
        myName = name;
        socket.emit('join_game', name);
    }
}

joinBtn.addEventListener('click', attemptJoin);

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        attemptJoin();
    }
});

socket.on('joined_successfully', () => {
    showScreen('waiting');
});

socket.on('waiting_players_update', (names) => {
    waitingPlayersList.innerHTML = names.map(n => `<span class="waiting-badge">${n}</span>`).join('');
});

socket.on('game_started', () => {
    showScreen('waiting');
});

socket.on('new_question', (data) => {
    selectedOptions = [];
    questionText.textContent = data.text;
    optionsContainer.innerHTML = '';
    myScoreDisplay.textContent = ''; 
    
    data.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'pf-c-button pf-m-secondary pf-m-block';
        btn.style.marginBottom = '10px';
        btn.textContent = opt;
        
        btn.onclick = () => {
            // Toggle Logic
            if (selectedOptions.includes(index)) {
                selectedOptions = selectedOptions.filter(i => i !== index);
                btn.classList.remove('pf-m-active');
            } else {
                selectedOptions.push(index);
                btn.classList.add('pf-m-active');
            }
            // Emit array of currently selected indices
            socket.emit('submit_answer', selectedOptions);
        };
        optionsContainer.appendChild(btn);
    });

    let timeLeft = data.timeLimit;
    timerDisplay.textContent = timeLeft;
    clearInterval(localTimer);
    
    localTimer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if(timeLeft <= 0) clearInterval(localTimer);
    }, 1000);

    showScreen('question');
});

socket.on('question_ended', (data) => {
    clearInterval(localTimer);
    showScreen('result');
    
    resultTitle.textContent = "Please Wait...";
    myScoreDisplay.textContent = ''; 

    resultText.innerHTML = '<span style="color: #d2d2d2; font-style: italic; font-size: 1.1rem;">Waiting for the next question...</span>';
});

socket.on('game_over', (leaderboard) => {
    showScreen('result');
    resultTitle.textContent = "Final Scoreboard";
    
    const myStats = leaderboard.find(p => p.name === myName);
    const myRank = leaderboard.findIndex(p => p.name === myName) + 1;
    
    if (myStats) {
        let personalRankIcon = '';
        if (myRank === 1) personalRankIcon = '🥇 ';
        else if (myRank === 2) personalRankIcon = '🥈 ';
        else if (myRank === 3) personalRankIcon = '🥉 ';

        myScoreDisplay.innerHTML = `You finished rank <strong style="font-size: 1.5rem; color: #ffffff;">${personalRankIcon}#${myRank}</strong> with <strong>${myStats.score}</strong> points!`;
    }

    // Changed from an ordered list (<ol>) to an unstyled list (<ul>) so we can use custom icons perfectly
    let html = '<ul style="list-style-type: none; padding-left: 0; text-align: left; margin: 0 auto; display: inline-block; color: #d2d2d2;">';
    
    leaderboard.forEach((p, idx) => {
        // Highlight the player's own row slightly so it's easy to spot
        const isMe = p.name === myName ? 'color: #ffffff; font-weight: bold; background-color: rgba(238,0,0,0.1); border-radius: 4px; padding: 4px 8px;' : 'padding: 4px 8px;';
        
        let rankIcon = '';
        if (idx === 0) rankIcon = '🥇';
        else if (idx === 1) rankIcon = '🥈';
        else if (idx === 2) rankIcon = '🥉';
        else rankIcon = `<span style="display:inline-block; width: 1.5em; text-align: center; color: #888;">${idx + 1}.</span>`;

        html += `<li style="${isMe}; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 1.4rem;">${rankIcon}</span>
            <span style="font-size: 1.1rem;">${p.name} - Score: ${p.score} <span style="font-size: 0.9rem; color: #a0a0a0;">(${p.totalTime.toFixed(2)}s)</span></span>
        </li>`;
    });
    
    html += '</ul>';
    
    resultText.innerHTML = html;
});
