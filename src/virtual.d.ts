// The rules and letters, validated and bundled at build time by src/lib/content/vite-plugin.ts.
declare module 'virtual:rollfix/content' {
	export const content: import('./lib/content/loader.ts').Content;
	export default content;
}
