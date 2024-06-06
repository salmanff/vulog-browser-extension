
// 220705 => CheckIfused?? or delete??

browser.runtime.sendMessage({ greeting: 'hello', url: window.location.href }).then((response) => {
    console.warn('Received response: ', response);
})

console.log('in browser got , url: window.location.href ', window.location.href)
console.warn('in browser got , url: window.location.href ', window.location.href)
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // onsole.log('Received request: ', request);
})
