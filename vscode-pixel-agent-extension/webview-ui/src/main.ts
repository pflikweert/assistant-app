import './styles.css';

const vscode = acquireVsCodeApi();

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app container.');
}

app.innerHTML = `
  <main class="screen">
    <section class="card">
      <p class="kicker">Pixel Agent</p>
      <h1>Live Webview</h1>
      <p class="body">Wijzig deze tekst of de stijl en je ziet direct HMR in de geopende panel.</p>
      <div class="status-row">
        <span>Status</span>
        <strong id="hmr-status">Connected</strong>
      </div>
      <button id="ping-button" type="button">Send Ping</button>
      <p class="timestamp" id="timestamp"></p>
    </section>
  </main>
`;

const timestamp = app.querySelector<HTMLParagraphElement>('#timestamp');
const button = app.querySelector<HTMLButtonElement>('#ping-button');
const status = app.querySelector<HTMLElement>('#hmr-status');

const updateTimestamp = () => {
  if (timestamp) {
    timestamp.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
  }
};

updateTimestamp();
window.setInterval(updateTimestamp, 1000);

button?.addEventListener('click', () => {
  vscode.postMessage({ type: 'ping', at: Date.now() });
  if (status) {
    status.textContent = 'Ping sent';
  }
});

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    if (status) {
      status.textContent = 'HMR updated';
    }
  });
}
