
let eventos = [];

const lista = document.getElementById("listaEventos");
const buscador = document.getElementById("buscarEvento");
const filtro = document.getElementById("filtroCategoria");

const formatoFecha = new Intl.DateTimeFormat("es-CL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Santiago"
});

async function cargarEventos() {
    try {
        const respuesta = await fetch("/api/eventos");

        if (!respuesta.ok) {
            throw new Error("Error al consultar eventos");
        }

        eventos = await respuesta.json();

        const categorias = [...new Set(
            eventos.map(evento => evento.categoria)
        )];

        filtro.replaceChildren(
            new Option("Todas las categorías", "")
        );

        categorias.forEach(categoria => {
            filtro.add(new Option(categoria, categoria));
        });

        mostrarEventos();

    } catch (error) {
        console.error(error);
        lista.textContent = "No se pudieron cargar los eventos.";
    }
}

function mostrarEventos() {
    const busqueda = buscador.value.toLowerCase().trim();
    const categoria = filtro.value;

    const filtrados = eventos.filter(evento => {
        const coincideTexto = evento.titulo
            .toLowerCase()
            .includes(busqueda);

        const coincideCategoria =
            !categoria || evento.categoria === categoria;

        return coincideTexto && coincideCategoria;
    });

    lista.replaceChildren();

    if (filtrados.length === 0) {
        lista.textContent = "No se encontraron eventos.";
        return;
    }

    filtrados.forEach(evento => {
        const tarjeta = document.createElement("article");
        tarjeta.className = "tarjeta-evento";

        const titulo = document.createElement("h3");
        titulo.textContent = evento.titulo;

        const categoriaTexto = document.createElement("p");
        categoriaTexto.textContent =
            `Categoría: ${evento.categoria}`;

        const fecha = document.createElement("p");
        fecha.textContent =
            `Fecha: ${formatoFecha.format(new Date(evento.fecha_inicio))}`;

        const lugar = document.createElement("p");
        lugar.textContent = `Lugar: ${evento.lugar}`;

        const cupos = document.createElement("p");
        
cupos.textContent =
    `Cupos disponibles: ${evento.cupos_disponibles} de ${evento.cupo_maximo}`;

if (evento.cupos_disponibles <= 0) {
    boton.disabled = true;
    boton.textContent = "Sin cupos";
}


        
const boton = document.createElement("button");
boton.textContent = "Inscribirme";
boton.type = "button";

boton.addEventListener("click", async () => {
    boton.disabled = true;
    boton.textContent = "Inscribiendo...";

    try {
        const respuesta = await fetch("/api/inscripciones", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id_evento: evento.id
            })
        });

        const resultado = await respuesta.json();

        if (respuesta.status === 401) {
            alert("Debes iniciar sesión para inscribirte.");
            window.location.href = "/login.html";
            return;
        }

        if (!respuesta.ok) {
            throw new Error(
                resultado.error || "Error al inscribirse"
            );
        }

        alert("¡Inscripción realizada correctamente!");

        boton.textContent = "Inscrito";

    } catch (error) {
        alert(error.message);
        boton.textContent = "Inscribirme";
        boton.disabled = false;
    }
});


        tarjeta.append(
            titulo,
            categoriaTexto,
            fecha,
            lugar,
            cupos,
            boton
        );

        lista.appendChild(tarjeta);
    });
}

buscador.addEventListener("input", mostrarEventos);
filtro.addEventListener("change", mostrarEventos);

cargarEventos();
