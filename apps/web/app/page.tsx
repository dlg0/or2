export default function Landing() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Welcome to Octorobot</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/sign-in"><button>I'm a Parent</button></a>
          <a href="/kid"><button>I'm a Kid</button></a>
          <a href="/play"><button>Skip to Play</button></a>
        </div>
      </div>
    </main>
  );
}
