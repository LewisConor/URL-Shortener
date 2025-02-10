/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.json`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { hash } from "crypto";

const ConvertToHex = (digest : ArrayBuffer) => [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const requestURL = new URL(request.url);
		const pathArray = requestURL.pathname.split('/').splice(1);

		switch(pathArray[0]) {
			case 'p': {
				const url = requestURL.searchParams.get("url");
				if(url == null) { return new Response("No URL Provided", { status: 400 }); }

				const encodedURL = new TextEncoder().encode(url);
				const hash512 = ConvertToHex(await crypto.subtle.digest({ name: "SHA-512" }, encodedURL));
				const hash256 = ConvertToHex(await crypto.subtle.digest({ name: "SHA-256" }, encodedURL));

				const hash = `${hash256.slice(0, 4)}${hash512.slice(hash512.length - 5, hash512.length - 1)}`;

				if((await env.kv.get(hash)) == null) { await env.kv.put(hash, url) }

				const shortURL = `${process.env.NODE_ENV === "development" ? `http://localhost:8787` : `https://urls.conorlewis.com`}/s/${hash}`

				return new Response(`Accepted.\nShort URL: ${shortURL}\nOriginal URL: ${url}`, { status: 201 });
			}
			case 's':
				const hash = pathArray[1];
				if(hash == null) { return new Response("No UUID Provided", { status: 400 }); }

				const result = await env.kv.get(hash);
				if(result == null) { return new Response("Not Found", { status: 404 }); }

				return Response.redirect(result, 302);
			default: return new Response("Not Found", { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
