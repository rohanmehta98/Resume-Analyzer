/* app.js */

const state = {
  file: null,
  analysis: null,
  resumeText: "", // We might get this back from the server or store it
  chatHistory: []
};

// UI Elements
const dropzone = document.getElementById('dropzone');
const resumeInput = document.getElementById('resumeInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const clearFile = document.getElementById('clearFile');
const targetRole = document.getElementById('targetRole');
const analyzeButton = document.getElementById('analyzeButton');
const loadingOverlay = document.getElementById('loadingOverlay');
const resultsSection = document.getElementById('resultsSection');
const dashboard = document.getElementById('dashboard');

const chatWidget = document.getElementById('chatWidget');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChat = document.getElementById('sendChat');
const closeChat = document.getElementById('closeChat');

// Initialize
bindEvents();

function bindEvents() {
  dropzone.addEventListener('click', () => resumeInput.click());
  resumeInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
  
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    handleFile(e.dataTransfer.files[0]);
  });
  
  clearFile.addEventListener('click', () => {
    state.file = null;
    updateFileUI();
  });
  
  analyzeButton.addEventListener('click', startAnalysis);
  
  sendChat.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  closeChat.addEventListener('click', () => {
    chatWidget.classList.remove('is-visible');
  });
}

function handleFile(file) {
  if (!file) return;
  if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type) && 
      !file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
    alert('Please upload a PDF or DOCX file.');
    return;
  }
  
  state.file = file;
  updateFileUI();
}

function updateFileUI() {
  if (state.file) {
    fileName.textContent = state.file.name;
    fileInfo.classList.add('is-visible');
    analyzeButton.disabled = false;
  } else {
    fileInfo.classList.remove('is-visible');
    analyzeButton.disabled = true;
    resumeInput.value = '';
  }
}

async function startAnalysis() {
  if (!state.file) return;
  
  loadingOverlay.classList.add('is-visible');
  
  const formData = new FormData();
  formData.append('resume', state.file);
  formData.append('targetRole', targetRole.value);

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.ok) {
      state.analysis = data.analysis;
      renderResults(data.analysis);
      chatWidget.classList.add('is-visible');
    } else {
      alert('Error: ' + data.error);
    }
  } catch (error) {
    console.error('Fetch error:', error);
    alert('Analysis failed. Check console for details.');
  } finally {
    loadingOverlay.classList.remove('is-visible');
  }
}

function renderResults(analysis) {
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth' });
  
  dashboard.innerHTML = `
    <div class="summary-banner">
      <div>
        <h2>${analysis.candidateName || 'Analysis Result'}</h2>
        <div class="summary-banner__role">${analysis.detectedRole || targetRole.value || 'Professional'}</div>
        <p class="summary-banner__text">${analysis.executiveSummary}</p>
      </div>
      <div class="score-ring">
        <div class="score-ring__value">${analysis.overallScore}</div>
        <div class="score-ring__suffix">Overall</div>
      </div>
    </div>
    
    <div class="dashboard-grid">
      <div class="panel">
        <h3 class="section-title">ATS Checks</h3>
        <ul class="ats-list">
          ${Object.entries(analysis.ats.checks).map(([key, passed]) => `
            <li>
              <span class="ats-list__label">${key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}</span>
              <span class="ats-list__state ${passed ? 'ats-list__state--pass' : 'ats-list__state--fail'}">
                ${passed ? '✓ PASS' : '✗ FAIL'}
              </span>
            </li>
          `).join('')}
        </ul>
      </div>
      
      <div class="panel">
        <h3 class="section-title">Critical Recommendations</h3>
        <div class="recommendation-list">
          ${analysis.recommendations.map(rec => `
            <div class="timeline-card timeline-card--${rec.priority.toLowerCase()}">
              <h4>${rec.title}</h4>
              <p>${rec.detail}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

async function sendMessage() {
  const msg = chatInput.value.trim();
  if (!msg || !state.analysis) return;
  
  appendMessage('user', msg);
  chatInput.value = '';
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        resumeText: JSON.stringify(state.analysis), // Using analysis as context for now
        history: state.chatHistory
      })
    });
    
    const data = await response.json();
    if (data.ok) {
      appendMessage('ai', data.answer);
      state.chatHistory.push({ role: 'user', parts: [{ text: msg }] });
      state.chatHistory.push({ role: 'model', parts: [{ text: data.answer }] });
    }
  } catch (err) {
    console.error(err);
    appendMessage('ai', 'Error connecting to AI assistant.');
  }
}

function appendMessage(role, text) {
  const div = document.createElement('div');
  div.className = `chat-message chat-message--${role}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
