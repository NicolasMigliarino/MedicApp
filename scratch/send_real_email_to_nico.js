async function sendRealTestEmail() {
    console.log("📧 Enviando solicitud de recuperación real a nmigliarino@gmail.com...");
    try {
        const res = await fetch('http://localhost:3000/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nmigliarino@gmail.com' })
        });
        const data = await res.json();
        console.log("✅ Respuesta del servidor (HTTP", res.status, "):", data);
    } catch (err) {
        console.error("🚨 Error:", err.message);
    } finally {
        process.exit(0);
    }
}

sendRealTestEmail();
