
const formulario = document.getElementById("formLogin");
const mensaje = document.getElementById("mensaje");

formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const correo = document.getElementById("correo").value;
    const contrasena = document.getElementById("contrasena").value;

    mensaje.textContent = "Verificando credenciales...";

    try {
        const respuesta = await fetchSeguro("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({ correo, contrasena })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            mensaje.textContent =
                datos.error || "No se pudo iniciar sesión";
            return;
        }

        window.location.href = "/index.html";

    } catch (error) {
        console.error(error);
        mensaje.textContent = "Error de conexión con el servidor";
    }
});
