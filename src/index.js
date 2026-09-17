export default {
    async fetch(request, env) {

        const url = new URL(request.url);

        /*
         * Route de test de notre API
         */

        if (url.pathname === "/api/test") {

            return new Response(
                JSON.stringify({
                    success: true,
                    message: "Paroles Mystères API fonctionne !"
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json; charset=UTF-8"
                    }
                }
            );

        }

        /*
         * Pour toutes les autres requêtes,
         * Cloudflare utilise les fichiers présents
         * dans le dossier public/.
         */

        return env.ASSETS.fetch(request);

    }
};
