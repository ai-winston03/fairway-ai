import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        yuba: {
          ink: "#09283c",
          blue: "#087ab5",
          sky: "#31b6df",
          sand: "#f4efe3",
          fairway: "#8ca65a"
        }
      },
      fontFamily: {
        display: ["Georgia", "ui-serif", "serif"]
      }
    }
  },
  plugins: []
};

export default config;
