// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const options = document.getElementById('options');
const previewContainer = document.getElementById('previewContainer');
const preview = document.getElementById('preview');
const actions = document.getElementById('actions');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const formatSelect = document.getElementById('formatSelect');
const includeThinking = document.getElementById('includeThinking');
const includeSystem = document.getElementById('includeSystem');
const messageCount = document.getElementById('messageCount');
const toast = document.getElementById('toast');

// State
let parsedData = null;
let fileName = 'conversation';

// File handling
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

// Handle file
function handleFile(file) {
  // Accept any file - AI Studio exports may not have extension
  fileName = file.name.replace(/\.json$/i, '');

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target.result);
      parsedData = parseAIStudioData(json);
      showUI();
      updatePreview();
    } catch (err) {
      showToast('Invalid JSON file');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// Parse AI Studio data
function parseAIStudioData(data) {
  const result = {
    systemInstruction: null,
    messages: []
  };

  // Extract system instruction
  if (data.systemInstruction?.parts?.[0]?.text) {
    result.systemInstruction = data.systemInstruction.parts[0].text;
  }

  // Extract messages from chunks
  const chunks = data.chunkedPrompt?.chunks || [];

  for (const chunk of chunks) {
    // Skip empty chunks
    if (!chunk.text && !chunk.parts?.length) continue;

    // Get text (from parts if available, otherwise from text)
    let text = chunk.text || '';
    if (chunk.parts?.length) {
      // Combine parts, filtering out thoughtSignature
      text = chunk.parts
        .filter(p => !p.thoughtSignature && p.text)
        .map(p => p.text)
        .join('');
    }

    // Skip if empty after processing
    if (!text.trim()) continue;

    const message = {
      role: chunk.role === 'model' ? 'assistant' : 'user',
      content: text.trim(),
      isThought: chunk.isThought || false
    };

    result.messages.push(message);
  }

  return result;
}

// Filter messages based on options
function getFilteredMessages() {
  if (!parsedData) return [];

  let messages = parsedData.messages;

  // Filter thinking if not included
  if (!includeThinking.checked) {
    messages = messages.filter(m => !m.isThought);
  }

  return messages;
}

// Convert to Markdown
function toMarkdown(messages, systemInstruction) {
  let md = '';

  if (includeSystem.checked && systemInstruction) {
    md += `**System**\n\n${systemInstruction}\n\n---\n\n`;
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    const suffix = msg.isThought ? ' *(thinking)*' : '';
    md += `**${role}**${suffix}\n\n${msg.content}`;

    // Add separator between messages, not after last one
    if (i < messages.length - 1) {
      md += '\n\n---\n\n';
    }
  }

  return md.trim();
}

// Convert to OpenAI JSON format
function toOpenAIJSON(messages, systemInstruction) {
  const result = [];

  if (includeSystem.checked && systemInstruction) {
    result.push({
      role: 'system',
      content: systemInstruction
    });
  }

  for (const msg of messages) {
    result.push({
      role: msg.role,
      content: msg.content
    });
  }

  return JSON.stringify(result, null, 2);
}

// Get formatted output
function getOutput() {
  const messages = getFilteredMessages();
  const format = formatSelect.value;

  if (format === 'markdown') {
    return toMarkdown(messages, parsedData?.systemInstruction);
  } else {
    return toOpenAIJSON(messages, parsedData?.systemInstruction);
  }
}

// Update preview
function updatePreview() {
  const messages = getFilteredMessages();
  const output = getOutput();

  preview.textContent = output;
  messageCount.textContent = `${messages.length} messages`;
}

// Show UI elements
function showUI() {
  options.classList.add('visible');
  previewContainer.classList.add('visible');
  actions.classList.add('visible');
}

// Event listeners for options
formatSelect.addEventListener('change', updatePreview);
includeThinking.addEventListener('change', updatePreview);
includeSystem.addEventListener('change', updatePreview);

// Copy to clipboard
copyBtn.addEventListener('click', async () => {
  const output = getOutput();
  try {
    await navigator.clipboard.writeText(output);
    showToast('Copied to clipboard');
  } catch (err) {
    showToast('Failed to copy');
    console.error(err);
  }
});

// Download file
downloadBtn.addEventListener('click', () => {
  const output = getOutput();
  const format = formatSelect.value;
  const ext = format === 'markdown' ? 'md' : 'json';
  const mimeType = format === 'markdown' ? 'text/markdown' : 'application/json';

  const blob = new Blob([output], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}_clean.${ext}`;
  a.click();

  URL.revokeObjectURL(url);
  showToast('File downloaded');
});

// Toast notification
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}
