import { useState, useEffect, useRef } from "react";

import "./App.css";

const GRID_SIZE = 20;
type Pos = [number, number];

const INITIAL_SNAKE: Pos[] = [[0, 0]];

// Pick a random cell that doesn't overlap any snake segment.
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

function App() {
  const [game, setGame] = useState<GameState>(initialGameState);
  const [gameOver, setGameOver] = useState(false);
  // Snake stays frozen until the player presses an arrow key for the first time.
  const [started, setStarted] = useState(false);
  // Stored in a ref so direction changes don't restart the movement interval.
  const directionRef = useRef<string>("right");
  // Tracks the direction used on the last tick — the true reference for what
  // counts as a reversal. Prevents right→down→left between two ticks from
  // killing the snake.
  const lastTickDirectionRef = useRef<string>("right");

  // Listen for arrow keys on the window. Sets direction and unfreeze the snake
  // on the first keypress.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const map: Record<string, string> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      if (map[e.key]) {
        e.preventDefault();
        const next = map[e.key];
        const opposite: Record<string, string> = {
          up: "down",
          down: "up",
          left: "right",
          right: "left",
        };
        // Block if opposite of the last applied direction (prevents neck collision)
        // OR opposite of the currently buffered direction (prevents a second rapid
        // keypress from cancelling out a buffered turn within the same tick window,
        // e.g. LEFT→buffer UP→press DOWN would pass the applied-direction check but
        // reverse the buffered UP, sending the head into seg[2]).
        if (
          next !== opposite[lastTickDirectionRef.current] &&
          next !== opposite[directionRef.current]
        ) {
          directionRef.current = next;
          setStarted(true);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Main game loop: advances the snake one cell every 200 ms.
  useEffect(() => {
    if (gameOver || !started) return;

    const interval = setInterval(() => {
      // Capture the last applied direction before the updater runs, so we have
      // a known-safe fallback if the buffered direction turns out to be dangerous.
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

        // Safety gate: regardless of what the key handler allowed through, reject
        // any direction whose next position lands on seg[1] or seg[2]. Those cells
        // are physically unreachable in one step without reversing into the body.
        // Fall back to the last applied direction which is always safe.
        const candidatePos = nextPos(directionRef.current);
        const hitsNearBody = prevSnake
          .slice(1, 3)
          .some((seg) => seg[0] === candidatePos[0] && seg[1] === candidatePos[1]);
        const dir = hitsNearBody ? prevAppliedDir : directionRef.current;

        // Sync refs so the key handler uses the actually applied direction from now on.
        lastTickDirectionRef.current = dir;
        directionRef.current = dir;

        const newHead = nextPos(dir);

        // Check wall collision.
        const hitWall =
          newHead[0] < 0 ||
          newHead[0] >= GRID_SIZE ||
          newHead[1] < 0 ||
          newHead[1] >= GRID_SIZE;

        // When eating food the tail stays (snake grows), so exclude only the
        // tail from the self-collision check in the non-eating case.
        const ateFood = newHead[0] === food[0] && newHead[1] === food[1];
        const bodyToCheck = ateFood ? prevSnake : prevSnake.slice(0, -1);
        const hitSelf = bodyToCheck.some(
          (seg) => seg[0] === newHead[0] && seg[1] === newHead[1],
        );

        if (hitWall || hitSelf) {
          setGameOver(true);
          return prevGame;
        }

        // Prepend new head. If food was eaten, keep the tail (growth); otherwise
        // remove it so the snake stays the same length.
        const newSnake = [newHead, ...prevSnake];
        if (ateFood) {
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
  };

  return (
    <section>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, 20px)`,
          gap: "1px",
        }}
      >
        {Array.from({ length: GRID_SIZE }).map((_, i) =>
          Array.from({ length: GRID_SIZE }).map((_, j) => {
            // findIndex so we can distinguish head (0) from body (>0) vs empty (-1).
            const snakeIdx = game.snake.findIndex(
              (seg) => seg[0] === i && seg[1] === j,
            );
            const isFood = game.food[0] === i && game.food[1] === j;
            const bg =
              snakeIdx === 0
                ? "#888888"
                : snakeIdx > 0
                  ? "#000000"
                  : isFood
                    ? "#22c55e"
                    : "#ccc";
            return (
              <div
                key={`${i}-${j}`}
                style={{
                  height: "20px",
                  background: bg,
                  border: snakeIdx >= 0 ? "1px solid #555" : "none",
                  boxSizing: "border-box",
                }}
              />
            );
          }),
        )}
      </div>
      {gameOver && (
        <div>
          <p>Game Over</p>
          <button onClick={handleRestart}>Restart</button>
        </div>
      )}
    </section>
  );
}

export default App;
