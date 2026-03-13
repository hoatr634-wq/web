// worker.js - Luồng xử lý độc lập
let timer = null;

self.onmessage = function(e) {
    if (e.data.type === 'START') {
        const { token, channelId, messages, delay } = e.data;
        
        timer = setInterval(async () => {
            const msg = messages[Math.floor(Math.random() * messages.length)];
            try {
                const res = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': token.trim(), 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ content: msg })
                });

                if (res.ok) {
                    self.postMessage({ type: 'SUCCESS', token: token });
                } else {
                    self.postMessage({ type: 'ERROR', token: token, status: res.status });
                }
            } catch (err) {
                self.postMessage({ type: 'ERROR', token: token, status: 'Lỗi Kết Nối' });
            }
        }, delay);
    } else if (e.data.type === 'STOP') {
        clearInterval(timer);
        self.terminate();
    }
};
