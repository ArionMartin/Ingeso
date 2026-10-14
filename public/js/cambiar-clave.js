
const formulario = document.getElementById("formCambiarClave");
const mensaje = document.getElementById("mensaje");
const boton = formulario.querySelector("button");

// Comprobar que el usuario tenga sesión
async function verificarSesion() {
    try {
        const respuesta = await fetch("/api/usuario-actual");

        if (!respuesta.ok) {
            window.location.replace("/login.html");
        }
    } catch {
        mensaje.textContent = "No se pudo verificar la sesión.";
        boton.disabled = true;
    }
}

formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const actual = document.getElementById("claveActual").value;
    const nueva = document.getElementById("claveNueva").value;
    const confirmar = document.getElementById("confirmarClave").value;

    if (nueva !== confirmar) {
        mensaje.textContent = "Las contraseñas no coinciden.";
        return;
    }

    if (nueva.length < 6) {
        mensaje.textContent = "Utiliza al menos 6 caracteres.";
        return;
    }

    if (nueva === actual) {
        mensaje.textContent = "Debes elegir una contraseña diferente.";
        return;
    }

    boton.disabled = true;
    mensaje.textContent = "Actualizando contraseña...";

    try {
        const respuesta = await fetch("/api/cambiar-clave", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                claveActual: actual,
                claveNueva: nueva,
                confirmarClave: confirmar
            })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                resultado.error || "No se pudo cambiar la contraseña"
            );
        }

        mensaje.style.color = "green";
        mensaje.textContent = "Contraseña actualizada correctamente.";

        formulario.reset();

    } catch (error) {
        mensaje.style.color = "#b42318";
        mensaje.textContent = error.message;
    } finally {
        boton.disabled = false;
    }
});

verificarSesion();
