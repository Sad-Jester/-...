function goBack() {
    window.history.back();
}

// Автоматический редирект на профиль через 3 секунды
setTimeout(() => {
    window.location.href = '/profile';
}, 3000);