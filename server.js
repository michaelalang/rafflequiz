const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- Application State ---
let players = {}; 
let questions = []; // Reverted to simple flat array
let currentQuestionIndex = -1;
let questionStartTime = 0;
let questionTimer = null;
let gameOverTimer = null;
const QUESTION_TIME_LIMIT = 15; 

// --- Helper Functions ---
const getLeaderboard = () => {
    return Object.values(players).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score; 
        return a.totalTime - b.totalTime; 
    });
};

const broadcastPlayerCount = () => {
    io.emit('update_player_count', Object.keys(players).length);
};

const broadcastWaitingPlayers = () => {
    const playerNames = Object.values(players).map(p => p.name);
    io.emit('waiting_players_update', playerNames);
};

const broadcastRealtimeStats = () => {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) return;
    const q = questions[currentQuestionIndex];
    
    let submittedCount = 0;
    let optionsCount = new Array(q.options.length).fill(0);
    
    Object.values(players).forEach(p => {
        if (p.currentAnswer && p.currentAnswer.length > 0) {
            submittedCount++;
            p.currentAnswer.forEach(idx => {
                if (idx >= 0 && idx < optionsCount.length) {
                    optionsCount[idx]++;
                }
            });
        }
    });
    
    io.emit('admin_realtime_stats', { submittedCount, optionsCount, totalPlayers: Object.keys(players).length });
};

// --- WebSocket Event Dictionary Implementation ---
io.on('connection', (socket) => {
    
    // Sync state with clients on connect
    socket.emit('update_questions_list', questions);
    socket.emit('update_player_count', Object.keys(players).length);
    socket.emit('waiting_players_update', Object.values(players).map(p => p.name));

    socket.on('join_game', (name) => {
        players[socket.id] = { id: socket.id, name: name, score: 0, totalTime: 0, currentAnswer: [] };
        let isLate = currentQuestionIndex >= 0;
        socket.emit('joined_successfully', { message: 'Connected successfully', isLate: isLate });
        broadcastPlayerCount();
        broadcastWaitingPlayers(); 
        
        if (questionTimer && currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
            const q = questions[currentQuestionIndex];
            const timeRemaining = QUESTION_TIME_LIMIT - Math.floor((Date.now() - questionStartTime) / 1000);
            if (timeRemaining > 0) {
                socket.emit('new_question', {
                    text: q.text,
                    options: q.options,
                    timeLimit: timeRemaining,
                    questionIndex: currentQuestionIndex
                });
            }
        }
    });

    // Replaying the game simply resets the index and player scores!
    socket.on('admin_start_game', () => {
        clearTimeout(questionTimer);
        clearTimeout(gameOverTimer);
        questionTimer = null;
        gameOverTimer = null;
        currentQuestionIndex = -1;
        Object.values(players).forEach(p => { p.score = 0; p.totalTime = 0; p.currentAnswer = []; });
        io.emit('game_started');
    });

    socket.on('admin_next_question', () => {
        if (questionTimer) return; // Prevent skipping active question and breaking scoring
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            const q = questions[currentQuestionIndex];
            Object.values(players).forEach(p => p.currentAnswer = []);
            
            io.emit('new_question', {
                text: q.text,
                options: q.options,
                timeLimit: QUESTION_TIME_LIMIT,
                questionIndex: currentQuestionIndex
            });
            questionStartTime = Date.now();
            broadcastRealtimeStats();

            clearTimeout(questionTimer);
            questionTimer = setTimeout(() => {
                questionTimer = null;
                Object.values(players).forEach(p => {
                    if (p.currentAnswer && Array.isArray(p.currentAnswer)) {
                        const isCorrect = p.currentAnswer.length === q.correct.length && 
                                          p.currentAnswer.every(val => q.correct.includes(val));
                        if (isCorrect) p.score += 1;
                    }
                });

                io.emit('question_ended', { correctIndex: q.correct, leaderboard: getLeaderboard() });

                if (currentQuestionIndex >= questions.length - 1) {
                    gameOverTimer = setTimeout(() => {
                        io.emit('game_over', getLeaderboard());
                    }, 5000);
                }
            }, QUESTION_TIME_LIMIT * 1000);
        }
    });

    // Simple add/edit
    socket.on('admin_save_question', (data) => {
        if (data.index !== null && data.index !== undefined && data.index >= 0) {
            questions[data.index] = data.question;
        } else {
            questions.push(data.question);
        }
        io.emit('update_questions_list', questions);
    });

    socket.on('submit_answer', (indicesArray) => {
        if (!questionTimer) return; // Ignore late submissions after question ended

        const player = players[socket.id];
        if (!player) return;

        const currentSorted = [...(player.currentAnswer || [])].sort().join(',');
        const newSorted = [...indicesArray].sort().join(',');

        if (currentSorted !== newSorted) {
            const timeTaken = (Date.now() - questionStartTime) / 1000;
            player.totalTime += timeTaken; 
            player.currentAnswer = indicesArray;
            broadcastRealtimeStats();
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        broadcastPlayerCount();
        broadcastWaitingPlayers(); 
        if (questionTimer) broadcastRealtimeStats();
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
