import { useState, useEffect, useRef } from "react";

const GRID_SIZE = 20;
const CELL_PX = 24;

type Pos = [number, number];
const INITIAL_SNAKE: Pos[] = [[0, 0]];

function randomFood(snake: Pos[]): Pos {
  let pos: Pos;
  do {
    pos = [
      Math.floor(Math.random() * GRID_SIZE),
      Math.floor(Math.random() * GRID_SIZE),
    ];
  } while (snake.some((seg) => seg[0] === pos[0] && seg[1] === pos[1]));
  return pos;
}

interface GameState {
  snake: Pos[];
  food: Pos;
}

function initialGameState(): GameState {
  return { snake: INITIAL_SNAKE, food: randomFood(INITIAL_SNAKE) };
}

export default function App() {
  const [game, setGame] = useState<GameState>(initialGameState);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const directionRef = useRef<string>("right");
  const lastTickDirectionRef = useRef<string>("right");

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const map: Record<string, string> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      if (!map[e.key]) return;
      e.preventDefault();
      const next = map[e.key];
      const opposite: Record<string, string> = {
        up: "down", down: "up", left: "right", right: "left",
      };
      if (
        next !== opposite[lastTickDirectionRef.current] &&
        next !== opposite[directionRef.current]
      ) {
        directionRef.current = next;
        setStarted(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (gameOver || !started) return;

    const interval = setInterval(() => {
      const prevAppliedDir = lastTickDirectionRef.current;

      setGame((prevGame) => {
        const { snake: prevSnake, food } = prevGame;
        const head = prevSnake[0];

        const nextPos = (d: string): Pos => {
          switch (d) {
            case "down":  return [head[0] + 1, head[1]];
            case "up":    return [head[0] - 1, head[1]];
            case "right": return [head[0], head[1] + 1];
            case "left":  return [head[0], head[1] - 1];
            default:      return head;
          }
        };

        const candidatePos = nextPos(directionRef.current);
        const hitsNearBody = prevSnake
          .slice(1, 3)
          .some((seg) => seg[0] === candidatePos[0] && seg[1] === candidatePos[1]);
        const dir = hitsNearBody ? prevAppliedDir : directionRef.current;

        lastTickDirectionRef.current = dir;
        directionRef.current = dir;

        const newHead = nextPos(dir);

        const hitWall =
          newHead[0] < 0 || newHead[0] >= GRID_SIZE ||
          newHead[1] < 0 || newHead[1] >= GRID_SIZE;

        const ateFood = newHead[0] === food[0] && newHead[1] === food[1];
        const bodyToCheck = ateFood ? prevSnake : prevSnake.slice(0, -1);
        const hitSelf = bodyToCheck.some(
          (seg) => seg[0] === newHead[0] && seg[1] === newHead[1],
        );

        if (hitWall || hitSelf) {
          setGameOver(true);
          return prevGame;
        }

        const newSnake = [newHead, ...prevSnake];
        if (ateFood) {
          setScore((s) => s + 1);
          return { snake: newSnake, food: randomFood(newSnake) };
        }
        newSnake.pop();
        return { snake: newSnake, food };
      });
    }, 200);

    return () => clearInterval(interval);
  }, [gameOver, started]);

  const handleRestart = () => {
    directionRef.current = "right";
    lastTickDirectionRef.current = "right";
    setGame(initialGameState());
    setGameOver(false);
    setStarted(false);
    setScore(0);
  };

  const gridPx = GRID_SIZE * CELL_PX + (GRID_SIZE - 1);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-6 p-4 font-mono">

      {/* Title */}
      <h1 className="text-4xl font-bold tracking-widest text-green-400"
          style={{ textShadow: "0 0 20px #4ade80, 0 0 40px #4ade80" }}>
        SNAKE
      </h1>

      {/* Score */}
      <div className="flex items-center gap-2 text-green-400 text-sm tracking-widest">
        <span className="text-green-600">SCORE</span>
        <span className="text-lg font-bold"
              style={{ textShadow: "0 0 8px #4ade80" }}>
          {String(score).padStart(4, "0")}
        </span>
      </div>

      {/* Board */}
      <div
        className="relative rounded-sm overflow-hidden"
        style={{
          width: gridPx,
          height: gridPx,
          boxShadow: "0 0 0 2px #14532d, 0 0 40px #052e16, 0 0 80px #052e16",
        }}
      >
        {/* Grid cells */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_PX}px)`,
            gap: "1px",
            background: "#0d1a10",
          }}
        >
          {Array.from({ length: GRID_SIZE }).map((_, i) =>
            Array.from({ length: GRID_SIZE }).map((_, j) => {
              const snakeIdx = game.snake.findIndex(
                (seg) => seg[0] === i && seg[1] === j,
              );
              const isFood = game.food[0] === i && game.food[1] === j;
              const isHead = snakeIdx === 0;
              const isBody = snakeIdx > 0;

              let bg = "#0f1f13"; // empty cell
              let shadow = "none";

              if (isHead) {
                bg = "#86efac";
                shadow = "0 0 8px #4ade80, 0 0 16px #4ade80";
              } else if (isBody) {
                const fade = Math.max(0.3, 1 - snakeIdx * 0.04);
                bg = `rgba(34, 197, 94, ${fade})`;
                shadow = `0 0 4px rgba(74, 222, 128, ${fade * 0.6})`;
              } else if (isFood) {
                bg = "#f87171";
                shadow = "0 0 8px #ef4444, 0 0 20px #ef4444";
              }

              return (
                <div
                  key={`${i}-${j}`}
                  style={{
                    height: CELL_PX,
                    background: bg,
                    boxShadow: shadow,
                    transition: "background 0.05s",
                  }}
                />
              );
            }),
          )}
        </div>

        {/* Overlay: waiting to start */}
        {!started && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
               style={{ background: "rgba(10,10,15,0.75)" }}>
            <p className="text-green-400 text-sm tracking-widest animate-pulse">
              PRESS ARROW KEY TO START
            </p>
          </div>
        )}

        {/* Overlay: game over */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
               style={{ background: "rgba(10,10,15,0.85)" }}>
            <p className="text-red-400 text-2xl font-bold tracking-widest"
               style={{ textShadow: "0 0 16px #ef4444" }}>
              GAME OVER
            </p>
            <p className="text-green-600 text-xs tracking-widest">
              SCORE: {score}
            </p>
            <button
              onClick={handleRestart}
              className="mt-2 px-6 py-2 text-xs tracking-widest font-bold text-black bg-green-400 rounded-sm hover:bg-green-300 active:scale-95 transition-all"
              style={{ boxShadow: "0 0 12px #4ade80" }}
            >
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>

      {/* Controls hint */}
      <p className="text-green-900 text-xs tracking-widest">
        USE ARROW KEYS TO MOVE
      </p>
    </div>
  );
}
