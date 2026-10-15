const menuUsuario = document.getElementById("menuUsuario");

function agregarEnlace(texto, destino) {
  const enlace = document.createElement("a");

  enlace.href = destino;
  enlace.textContent = texto;

  menuUsuario.appendChild(enlace);
}

async function configurarMenu() {
  if (!menuUsuario) return;

  try {
    const respuesta = await fetch("/api/usuario-actual", {
      credentials: "same-origin",
      cache: "no-store",
    });

    menuUsuario.replaceChildren();

    // Usuario sin sesión
    if (respuesta.status === 401) {
      agregarEnlace("Iniciar sesión", "/login.html");
      agregarEnlace("Registrarse", "/registro.html");
      return;
    }

    if (!respuesta.ok) {
      throw new Error("No se pudo verificar la sesión");
    }

    const datos = await respuesta.json();
    const usuario = datos.usuario;

    if (!usuario) {
      throw new Error("Respuesta de usuario inválida");
    }

    // Participante
    if (usuario.rol === "participante") {
      agregarEnlace("Mis inscripciones", "/mis-inscripciones.html");
    }

    // Organizador
    if (usuario.rol === "organizador") {
      agregarEnlace("Panel del organizador", "/organizador.html");
    }

    // Administrador
    if (usuario.rol === "administrador") {
      agregarEnlace("Panel de administración", "/administrador.html");
    }

    // Opciones de cualquier usuario autenticado
    agregarEnlace("Cambiar contraseña", "/cambiar-clave.html");

    // Botón para cerrar sesión
    const botonSalir = document.createElement("button");

    botonSalir.type = "button";
    botonSalir.textContent = "Cerrar sesión";
    botonSalir.className = "boton-salir";

    botonSalir.addEventListener("click", async () => {
      botonSalir.disabled = true;

      try {
        const respuesta = await fetch("/api/logout", {
          method: "POST",
          credentials: "same-origin",
        });

        if (!respuesta.ok) {
          throw new Error("No se pudo cerrar sesión");
        }

        window.location.replace("/index.html");
      } catch (error) {
        alert(error.message);
        botonSalir.disabled = false;
      }
    });

    menuUsuario.appendChild(botonSalir);
  } catch (error) {
    console.error("Error del menú:", error);
    menuUsuario.replaceChildren();
    menuUsuario.textContent = "No se pudo cargar el menú. Intenta actualizar.";
  }
}

configurarMenu();
