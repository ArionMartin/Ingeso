
const lista = document.getElementById("listaInscripciones");
const bienvenida = document.getElementById("bienvenida");

const formatoFecha = new Intl.DateTimeFormat("es-CL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Santiago"
});

async function iniciarPagina() {
    try {
        const respuesta = await fetch("/api/usuario-actual");

        if (!respuesta.ok) {
            window.location.replace("/login.html");
            return;
        }

        const datos = await respuesta.json();

        if (datos.usuario.rol !== "participante") {
            bienvenida.textContent =
                "Esta página es exclusiva para participantes.";
            lista.textContent = "Acceso no autorizado.";
            return;
        }

        bienvenida.textContent =
            `Bienvenido, ${datos.usuario.nombre}`;

        await cargarInscripciones();

    } catch (error) {
        lista.textContent = "Error al verificar la sesión.";
        console.error(error);
    }
}

async function cargarInscripciones() {
    try {
        const respuesta = await fetch("/api/mis-inscripciones");

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar las inscripciones");
        }

        const inscripciones = await respuesta.json();
        lista.replaceChildren();

        if (inscripciones.length === 0) {
            lista.textContent =
                "Todavía no tienes inscripciones.";
            return;
        }

        inscripciones.forEach(inscripcion => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "tarjeta-inscripcion";

            const titulo = document.createElement("h4");
            titulo.textContent = inscripcion.titulo;

            const categoria = document.createElement("p");
            categoria.textContent =
                `Categoría: ${inscripcion.categoria}`;

            const fecha = document.createElement("p");
            fecha.textContent =
                `Fecha: ${formatoFecha.format(new Date(inscripcion.fecha_inicio))}`;

            const lugar = document.createElement("p");
            lugar.textContent =
                `Lugar: ${inscripcion.lugar}`;

            const estado = document.createElement("p");
            estado.textContent =
                `Estado: ${inscripcion.estado}`;

            estado.className =
                inscripcion.estado === "activa"
                    ? "estado-activa"
                    : "estado-cancelada";

            tarjeta.append(
                titulo,
                categoria,
                fecha,
                lugar,
                estado
            );

            if (inscripcion.estado === "activa") {
                const boton = document.createElement("button");
                boton.type = "button";
                boton.textContent = "Cancelar inscripción";
                boton.className = "btn-cancelar";

                // El servidor siempre valida el plazo.
                const dentroDePlazo =
                    new Date(inscripcion.fecha_limite) >= new Date();

                if (!dentroDePlazo) {
                    boton.disabled = true;
                    boton.textContent = "Plazo de cancelación cerrado";
                } else {
                    boton.addEventListener("click", async () => {
                        const confirmar = window.confirm(
                            `¿Deseas cancelar tu inscripción a ${inscripcion.titulo}?`
                        );

                        if (!confirmar) return;

                        boton.disabled = true;

                        try {
                            const respuesta = await fetch(
                                `/api/inscripciones/${inscripcion.id}/cancelar`,
                                {
                                    method: "PATCH",
                                    credentials: "same-origin"
                                }
                            );

                            const resultado = await respuesta.json();

                            if (!respuesta.ok) {
                                throw new Error(
                                    resultado.error ||
                                    "No se pudo cancelar"
                                );
                            }

                            alert("Inscripción cancelada correctamente.");
                            await cargarInscripciones();

                        } catch (error) {
                            alert(error.message);
                            boton.disabled = false;
                        }
                    });
                }

                tarjeta.appendChild(boton);
            }

            lista.appendChild(tarjeta);
        });

    } catch (error) {
        lista.textContent = error.message;
    }
}

iniciarPagina();
