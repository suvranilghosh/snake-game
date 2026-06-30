import { useState, useEffect, useRef } from "react";

const GRID_SIZE = 20;
const CELL_PX = 24;
const TICK_MS = 150;

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

const OPPOSITE: Record<string, string> = {
  up: "down", down: "up", left: "right", right: "left",
};

export default function App() {
  const [game, setGame] = useState<GameState>(initialGameState);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);

  // FIFO queue of pending direction changes — processed one per tick so rapid
  // keypresses are heard in order rather than the last one overwriting the rest.
  const directionQueueRef = useRef<string[]>([]);
  // Direction that was applied on the most recent tick.
  const lastTickDirectionRef = useRef<string>("right");
  // Snake length kept in a ref so the key handler can read it without stale closure.
  const snakeLengthRef = useRef<number>(1);

  // Keep snakeLengthRef in sync whenever the snake grows or shrinks.
  useEffect(() => {
    snakeLengthRef.current = game.snake.length;
  }, [game.snake.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const map: Record<string, string> = {
        ArrowUp: "up", ArrowDown: "down",
        ArrowLeft: "left", ArrowRight: "right",
      };
      if (!map[e.key]) return;
      e.preventDefault();
      const next = map[e.key];

      // The "effective last direction" is the tail of the queue (what the snake
      // will be doing when this input is finally processed) or, if the queue is
      // empty, whatever was applied last tick.
      const queue = directionQueueRef.current;
      const refDir = queue.length > 0
        ? queue[queue.length - 1]
        : lastTickDirectionRef.current;

      // A length-1 snake has no body, so any direction — including a reversal —
      // is always safe. For longer snakes, block reversal against both the
      // effective last direction and the tick-applied direction.
      const isLength1 = snakeLengthRef.current === 1;
      const blocked =
        !isLength1 &&
        (next === OPPOSITE[refDir] || next === OPPOSITE[lastTickDirectionRef.current]);

      if (!blocked) {
        // Cap the queue at 2 so the buffer doesn't grow stale on key-spam.
        if (queue.length < 2) queue.push(next);
        setStarted(true);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (gameOver || !started) return;

    const interval = setInterval(() => {
      // Consume the next queued direction, or keep going the same way.
      const queue = directionQueueRef.current;
      const prevAppliedDir = lastTickDirectionRef.current;
      const nextDir = queue.length > 0 ? queue.shift()! : prevAppliedDir;

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

        // Safety gate: if the dequeued direction would land the head on seg[1]
        // or seg[2], fall back to the previously applied direction.
        // Skipped for length-1 snakes (no body segments to hit).
        const candidatePos = nextPos(nextDir);
        const hitsNearBody =
          prevSnake.length > 1 &&
          prevSnake
            .slice(1, 3)
            .some((seg) => seg[0] === candidatePos[0] && seg[1] === candidatePos[1]);
        const dir = hitsNearBody ? prevAppliedDir : nextDir;

        lastTickDirectionRef.current = dir;

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
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [gameOver, started]);

  const handleRestart = () => {
    directionQueueRef.current = [];
    lastTickDirectionRef.current = "right";
    snakeLengthRef.current = 1;
    setGame(initialGameState());
    setGameOver(false);
    setStarted(false);
    setScore(0);
  };

  const gridPx = GRID_SIZE * CELL_PX + (GRID_SIZE - 1);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-6 p-4 font-mono">

      <h1 className="text-4xl font-bold tracking-widest text-green-400"
          style={{ textShadow: "0 0 20px #4ade80, 0 0 40px #4ade80" }}>
        SNAKE
      </h1>

      <div className="flex items-center gap-2 text-green-400 text-sm tracking-widest">
        <span className="text-green-600">SCORE</span>
        <span className="text-lg font-bold" style={{ textShadow: "0 0 8px #4ade80" }}>
          {String(score).padStart(4, "0")}
        </span>
      </div>

      <div
        className="relative rounded-sm overflow-hidden"
        style={{
          width: gridPx,
          height: gridPx,
          boxShadow: "0 0 0 2px #14532d, 0 0 40px #052e16, 0 0 80px #052e16",
        }}
      >
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

              let bg = "#0f1f13";
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

        {!started && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
               style={{ background: "rgba(10,10,15,0.75)" }}>
            <p className="text-green-400 text-sm tracking-widest animate-pulse">
              PRESS ARROW KEY TO START
            </p>
          </div>
        )}

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

      <p className="text-green-900 text-xs tracking-widest">
        USE ARROW KEYS TO MOVE
      </p>
    </div>
  );
}
