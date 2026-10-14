
let csrfToken = null;

async function obtenerTokenCSRF() {
    if (csrfToken) {
        return csrfToken;
    }

    const respuesta = await fetch("/api/csrf-token", {
        credentials: "same-origin",
        cache: "no-store"
    });

    if (!respuesta.ok) {
        throw new Error("No se pudo obtener el token CSRF");
    }

    const datos = await respuesta.json();
    csrfToken = datos.csrfToken;

    return csrfToken;
}

async function fetchSeguro(url, opciones = {}) {
    const metodo = (opciones.method || "GET").toUpperCase();
    const headers = new Headers(opciones.headers || {});

    if (!["GET", "HEAD", "OPTIONS"].includes(metodo)) {
        headers.set("X-CSRF-Token", await obtenerTokenCSRF());
    }

    return fetch(url, {
        ...opciones,
        headers,
        credentials: "same-origin"
    });
}
