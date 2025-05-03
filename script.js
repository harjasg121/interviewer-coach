let mediaRecorder;
let recordedChunks = [];
let currentInterviewId = null;

const previewVideo = document.getElementById('preview');
const recordedVideo = document.getElementById('recorded');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const feedbackSection = document.getElementById('feedbackSection');
const questionDisplay = document.getElementById('questionDisplay');
const newQuestionBtn = document.getElementById('newQuestionBtn');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Initialize video stream
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        previewVideo.srcObject = stream;
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            recordedVideo.src = URL.createObjectURL(blob);
            recordedVideo.classList.remove('hidden');
            analyzeBtn.disabled = false;
        };

        // Get initial question
        await getNewQuestion();
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Error accessing camera. Please ensure you have granted camera permissions.');
    }
}

// Get a new interview question
async function getNewQuestion() {
    try {
        newQuestionBtn.disabled = true;
        questionDisplay.textContent = "Loading new question...";
        const response = await fetch('/api/question');
        const data = await response.json();
        if (data.success) {
            questionDisplay.textContent = data.question;
        }
    } catch (error) {
        console.error('Error fetching question:', error);
        questionDisplay.textContent = "Error loading question. Please try again.";
    } finally {
        newQuestionBtn.disabled = false;
    }
}

// Add event listener for new question button
newQuestionBtn.addEventListener('click', getNewQuestion);

// Start recording
startBtn.addEventListener('click', () => {
    recordedChunks = [];
    mediaRecorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    analyzeBtn.disabled = true;
    recordedVideo.classList.add('hidden');
    feedbackSection.classList.add('hidden');
});

// Stop recording
stopBtn.addEventListener('click', () => {
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
});

// Analyze interview
analyzeBtn.addEventListener('click', async () => {
    try {
        analyzeBtn.disabled = true;
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const formData = new FormData();
        formData.append('video', blob, 'interview.webm');

        // Upload video
        const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadResponse.json();

        if (!uploadData.success) {
            throw new Error(uploadData.error);
        }

        currentInterviewId = uploadData.interviewId;

        // Analyze video
        const analyzeResponse = await fetch(`/api/analyze/${currentInterviewId}`, {
            method: 'POST'
        });
        const analyzeData = await analyzeResponse.json();

        if (!analyzeData.success) {
            throw new Error(analyzeData.error);
        }

        // Display feedback
        displayFeedback(analyzeData.feedback);
        loadInterviewHistory();
    } catch (error) {
        console.error('Error analyzing interview:', error);
        alert('Error analyzing interview. Please try again.');
        analyzeBtn.disabled = false;
    }
});

// Display feedback
function displayFeedback(feedback) {
    document.getElementById('toneFeedback').textContent = feedback.tone;
    document.getElementById('clarityFeedback').textContent = feedback.clarity;
    document.getElementById('contentFeedback').textContent = feedback.content;

    const suggestionsList = document.getElementById('suggestionsList');
    suggestionsList.innerHTML = '';
    feedback.suggestions.forEach(suggestion => {
        const li = document.createElement('li');
        li.textContent = suggestion;
        suggestionsList.appendChild(li);
    });

    feedbackSection.classList.remove('hidden');
}

// Load interview history
async function loadInterviewHistory() {
    try {
        const response = await fetch('/api/history');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        historyList.innerHTML = '';

        data.interviews.forEach(interview => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <h3>Interview ${new Date(interview.timestamp).toLocaleString()}</h3>
                <p><strong>Tone:</strong> ${interview.feedback.tone}</p>
                <p><strong>Clarity:</strong> ${interview.feedback.clarity}</p>
                <p><strong>Content:</strong> ${interview.feedback.content}</p>
            `;
            historyList.appendChild(historyItem);
        });
    } catch (error) {
        console.error('Error loading interview history:', error);
    }
}

// Clear interview history
async function clearHistory() {
    try {
        clearHistoryBtn.disabled = true;
        const response = await fetch('/api/history', {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            historyList.innerHTML = '';
            alert('Interview history cleared successfully');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Error clearing history:', error);
        alert('Error clearing history. Please try again.');
    } finally {
        clearHistoryBtn.disabled = false;
    }
}

// Add event listener for clear history button
clearHistoryBtn.addEventListener('click', clearHistory);

// Initialize the app
initCamera();
loadInterviewHistory(); 