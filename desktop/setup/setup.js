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
  },
};

const form = document.querySelector('form');
const input = document.querySelector('#server-url');
const output = document.querySelector('output');
const submit = document.querySelector('.connect');
let language = navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';

function render() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-copy]').forEach((element) => {
    element.textContent = copy[language][element.dataset.copy];
  });
  document.querySelectorAll('[data-language]').forEach((button) => {
    button.classList.toggle('active', button.dataset.language === language);
  });
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
    output.textContent = result.error;
    submit.disabled = false;
  }
});

window.schwankDesktop.getState().then((state) => {
  input.value = state.serverUrl || 'http://schwank.local:3000';
  document.querySelector('#version').textContent = `schwank ${state.version}`;
});

render();
