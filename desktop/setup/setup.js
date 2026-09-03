const copy = {
  en: {
    eyebrow: 'Desktop client setup',
    title: 'Connect to your home server',
    intro:
      'Enter the LAN address of the Orange Pi running schwank. You only need to do this once.',
    label: 'Server address',
    connect: 'Test and connect',
    connecting: 'Checking the server…',
    hint: 'Example: http://192.168.1.25:3000 or https://schwank.home',
    privacyTitle: 'Your data stays on your server',
    privacyCopy:
      'The desktop app stores only this address. Accounts, meals, messages, and household data remain on the Orange Pi.',
    desktopOnly: 'Desktop client for macOS, Windows, and Linux',
    connected: 'Connected. Opening schwank…',
    setupWindowTitle: 'Connect to schwank',
    offlineWindowTitle: 'schwank is offline',
    offlineEyebrow: 'Connection interrupted',
    offlineTitle: 'Your home server is offline',
    offlineIntro:
      'schwank could not reach the saved server. Your address is still saved, so you can retry when the Orange Pi is available.',
    savedServer: 'Saved server',
    retry: 'Try again',
    retrying: 'Trying again…',
    changeServer: 'Change server',
    checkTitle: 'A few things to check',
    checkPower: 'The Orange Pi is powered on and schwank is running.',
    checkNetwork: 'This computer is connected to the same home network.',
    checkAddress: 'The Orange Pi still has the saved network address.',
    errors: {
      'invalid-address':
        'Enter a private LAN address, or an HTTPS address without an extra path.',
      'timed-out':
        'The server took too long to respond. Check the network and try again.',
      unreachable:
        'The server could not be reached. Check that it is on and connected.',
      unavailable:
        'The server responded, but schwank is not available right now.',
      incompatible: 'That address is not a compatible schwank server.',
    },
  },
  ru: {
    eyebrow: 'Настройка приложения',
    title: 'Подключитесь к домашнему серверу',
    intro:
      'Введите адрес Orange Pi в локальной сети, где запущен schwank. Это нужно сделать только один раз.',
    label: 'Адрес сервера',
    connect: 'Проверить и подключиться',
    connecting: 'Проверяем сервер…',
    hint: 'Пример: http://192.168.1.25:3000 или https://schwank.home',
    privacyTitle: 'Данные остаются на вашем сервере',
    privacyCopy:
      'Приложение хранит только этот адрес. Аккаунты, питание, сообщения и данные дома остаются на Orange Pi.',
    desktopOnly: 'Приложение для macOS, Windows и Linux',
    connected: 'Подключено. Открываем schwank…',
    setupWindowTitle: 'Подключение к schwank',
    offlineWindowTitle: 'schwank не в сети',
    offlineEyebrow: 'Связь прервана',
    offlineTitle: 'Домашний сервер не в сети',
    offlineIntro:
      'schwank не смог связаться с сохранённым сервером. Адрес остался на месте — повторите попытку, когда Orange Pi будет доступен.',
    savedServer: 'Сохранённый сервер',
    retry: 'Повторить',
    retrying: 'Повторяем…',
    changeServer: 'Изменить сервер',
    checkTitle: 'Что проверить',
    checkPower: 'Orange Pi включён, а schwank запущен.',
    checkNetwork: 'Компьютер подключён к той же домашней сети.',
    checkAddress: 'У Orange Pi всё ещё этот сетевой адрес.',
    errors: {
      'invalid-address':
        'Введите адрес в локальной сети или HTTPS-адрес без лишнего пути.',
      'timed-out': 'Сервер отвечает слишком долго. Проверьте сеть.',
      unreachable:
        'Не удалось связаться с сервером. Проверьте, что он включён и подключён.',
      unavailable: 'Сервер ответил, но schwank сейчас недоступен.',
      incompatible: 'По этому адресу нет совместимого сервера schwank.',
    },
  },
};

const form = document.querySelector('form');
const input = document.querySelector('#server-url');
const output = document.querySelector('output');
const submit = document.querySelector('.connect');
const setupView = document.querySelector('#setup-view');
const offlineView = document.querySelector('#offline-view');
const retry = document.querySelector('#retry');
const changeServer = document.querySelector('#change-server');
const offlineError = document.querySelector('.offline-error');
let language = navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
let view = 'setup';
let errorCode = null;

function errorMessage(code) {
  return copy[language].errors[code] || copy[language].errors.unreachable;
}

function render() {
  document.documentElement.lang = language;
  document.title =
    view === 'offline'
      ? copy[language].offlineWindowTitle
      : copy[language].setupWindowTitle;
  document.querySelectorAll('[data-copy]').forEach((element) => {
    element.textContent = copy[language][element.dataset.copy];
  });
  document.querySelectorAll('[data-language]').forEach((button) => {
    button.classList.toggle('active', button.dataset.language === language);
  });
  setupView.hidden = view !== 'setup';
  offlineView.hidden = view !== 'offline';
  offlineError.textContent = view === 'offline' ? errorMessage(errorCode) : '';
}

document.querySelectorAll('[data-language]').forEach((button) => {
  button.addEventListener('click', () => {
    language = button.dataset.language;
    render();
  });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  output.className = '';
  output.textContent = copy[language].connecting;
  submit.disabled = true;
  const result = await window.schwankDesktop.connect(input.value);
  if (result.ok) {
    output.className = 'success';
    output.textContent = copy[language].connected;
  } else {
    output.className = 'error';
    output.textContent = errorMessage(result.error);
    submit.disabled = false;
  }
});

retry.addEventListener('click', async () => {
  retry.disabled = true;
  retry.textContent = copy[language].retrying;
  offlineError.textContent = '';
  const result = await window.schwankDesktop.retry();
  if (!result.ok) {
    errorCode = result.error;
    offlineError.textContent = errorMessage(errorCode);
    retry.disabled = false;
    retry.textContent = copy[language].retry;
  }
});

changeServer.addEventListener('click', () => {
  view = 'setup';
  output.textContent = '';
  render();
  input.focus();
  input.select();
});

window.schwankDesktop.getState().then((state) => {
  input.value = state.serverUrl || 'http://schwank.local:3000';
  document.querySelector('#saved-server').textContent = state.serverUrl || '—';
  document.querySelector('#version').textContent = `schwank ${state.version}`;
  view = state.view === 'offline' ? 'offline' : 'setup';
  errorCode = state.connectionError;
  render();
});

render();
