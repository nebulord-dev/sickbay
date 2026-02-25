import { useState } from "react";
import { Header } from "./components/Header";
import { PostList } from "./components/PostList";
import { UserCard } from "./components/UserCard";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <Header />
      <main>
        <UserCard name="jane doe" email="jane@example.com" role="admin" />
        <div>
          <button
            onClick={() => setCount((count) => count + 1)}
            className="bg-blue-800 px-2 py-1 rounded"
          >
            count is {count}
          </button>
          <button
            className="fixed bottom-6 bg-green-500 right-6 w-14 h-14 text-black rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center text-2xl z-50"
            title="AI Assistant"
          >
            <svg
              width="200"
              height="200"
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="oklch(72.3% 0.219 149.579)"
              />

              <g transform="translate(145, 55)">
                <path
                  d="M 0,-12 L 1.5,-3 L 10,-1.5 L 1.5,0 L 0,12 L -1.5,0 L -10,-1.5 L -1.5,-3 Z"
                  fill="white"
                  opacity="0.9"
                />
                <circle cx="8" cy="-8" r="2" fill="white" opacity="0.7" />
                <circle cx="-6" cy="6" r="1.5" fill="white" opacity="0.6" />
              </g>

              <text
                x="100"
                y="115"
                fontFamily="Arial, sans-serif"
                fontSize="48"
                fontWeight="bold"
                fill="white"
                textAnchor="middle"
              >
                VAI
              </text>
            </svg>
          </button>
        </div>
        <PostList />
      </main>
    </>
  );
}

export default App;
