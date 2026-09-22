function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Forum Newsreader popup is missing ${selector}.`);
  return element;
}

const enabled = requiredElement<HTMLInputElement>('#enabled');
const site = requiredElement<HTMLElement>('#site');
const openOptions = requiredElement<HTMLButtonElement>('#open-options');

let hostname = '';

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

async function init(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let url: URL | undefined;
  try {
    if (tab?.url) url = new URL(tab.url);
  } catch {
    url = undefined;
  }

  hostname = url?.hostname ?? '';
  if (hostname !== 'is.muni.cz' || !url?.pathname.startsWith('/auth/discussion/')) {
    site.textContent = 'Open an IS MU discussion first.';
    enabled.disabled = true;
    return;
  }

  const result = await chrome.storage.sync.get('enabledHosts');
  site.textContent = hostname;
  enabled.checked = stringArray(result.enabledHosts).includes(hostname);
}

enabled.addEventListener('change', async () => {
  const result = await chrome.storage.sync.get('enabledHosts');
  const hosts = new Set(stringArray(result.enabledHosts));
  enabled.checked ? hosts.add(hostname) : hosts.delete(hostname);
  await chrome.storage.sync.set({ enabledHosts: [...hosts] });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await chrome.tabs.reload(tab.id);
});

openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
void init();
