
const formulario = document.getElementById("formRegistro");
const mensaje = document.getElementById("mensaje");
const boton = document.getElementById("botonRegistro");

formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nombre = document.getElementById("nombre").value.trim();
    const correo = document.getElementById("correo").value.trim();
    const contrasena = document.getElementById("contrasena").value;
    const confirmar = document.getElementById("confirmar").value;

    if (contrasena.length < 6) {
        mensaje.textContent = "La contraseña debe tener mínimo 6 caracteres.";
        return;
    }

    if (contrasena !== confirmar) {
        mensaje.textContent = "Las contraseñas no coinciden.";
        return;
    }

    boton.disabled = true;
    mensaje.textContent = "Registrando estudiante...";

    try {
        const respuesta = await fetchSeguro("/api/registro", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nombre,
                correo,
                contrasena,
                confirmar
            })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(datos.error || "Error al crear la cuenta");
        }

        mensaje.style.color = "green";
        mensaje.textContent = "Cuenta creada correctamente.";

        formulario.reset();

        // Ir al inicio de sesión
        window.location.replace("/login.html");

    } catch (error) {
        mensaje.style.color = "#b42318";
        mensaje.textContent = error.message;

    } finally {
        boton.disabled = false;
    }
});
