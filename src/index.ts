/**
 * Converts an incoming digest into a Hexadecimal string
 * @param digest - The output buffer from Algorithmic Digest of data
 * @returns A Hexadecimal String
 */
const ConvertToHex = (digest : ArrayBuffer) => [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');

export default {
	async fetch(request, env, ctx): Promise<Response> {
		try {
			// Takes the incoming request url string into a URL Object 
			const requestURL = new URL(request.url);

			// Splits the URL path by the '/' character and removes the first element
			const pathArray = requestURL.pathname.split('/').splice(1);

			// Endpoint Switch [ p - Creates new Short URL, S - Finds & Redirects to True URL, L - Lists all active Short URLs, default - Not Found ]
			switch(pathArray[0]) {
				case 'p': {
					// Gets the URL to Shorten. Fails if not provided.
					const url = requestURL.searchParams.get("url");
					if(url == null) { return new Response("No URL Provided", { status: 400 }); }

					//Encodes the URL String for Digest using SHA-512 and SHA-256
					const encodedURL = new TextEncoder().encode(url);
					const hash512 = ConvertToHex(await crypto.subtle.digest({ name: "SHA-512" }, encodedURL));
					const hash256 = ConvertToHex(await crypto.subtle.digest({ name: "SHA-256" }, encodedURL));

					//Piece together a 8 Character String. Possible Birthday Paradox Collision after ~65,536 entires
					const hash = `${hash256.slice(0, 4)}${hash512.slice(hash512.length - 5, hash512.length - 1)}`;

					//Check if we already have this hash, if not, write to KV with Hash and URL
					if((await env.kv.get(hash)) == null) { await env.kv.put(hash, url) }

					//Create the short URL based on current cycle
					const shortURL = `${env.NODE_ENV === "development" ? `http://localhost:8787` : `https://urls.conorlewis.com`}/s/${hash}`

					//Return 201 with the new Short URL & Orginal URL 
					return new Response(`Accepted.\nShort URL: ${shortURL}\nOriginal URL: ${url}`, { status: 201 });
				}
				case 's':
					//Get the Hash from the second part of the endpoint. Fails if not provided.
					const hash = pathArray[1];
					if(hash == null) { return new Response("No UUID Provided", { status: 400 }); }

					//Check if it exists. If not, return 404
					const result = await env.kv.get(hash);
					if(result == null) { return new Response("Not Found", { status: 404 }); }

					//If found, redirect the user.
					return Response.redirect(result, 302);
				case 'l':
					//Get a List of all the keys
					const list = await env.kv.list();

					//Promise All & Map over the list providing the Short URL to the Original 
					const output = (await Promise.all(list.keys.map(async (v) => {
						return `${env.NODE_ENV === "development" ? `http://localhost:8787` : `https://urls.conorlewis.com`}/s/${v.name} -> ${await env.kv.get(v.name)}\n\n`;
					}))).join('');

					//Return this output to the user
					return new Response(output, { status: 200 });
				default: return new Response("Not Found", { status: 404 });
			}
		} catch(e) {
			//Something went wrong.
			console.log(e); return new Response("Server Error", { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
