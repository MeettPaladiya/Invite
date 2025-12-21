/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#6366f1',
                secondary: '#8b5cf6',
                accent: '#22d3ee',
                dark: {
                    900: '#0f0f1a',
                    800: '#1a1a2e',
                    700: '#16213e',
                    600: '#1e2746',
                }
            }
        },
    },
    plugins: [],
}
