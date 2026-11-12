import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Router as WouterRouter, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import SliceOfFlow from "./pages/SliceOfFlow";
import Game from "./pages/Game";
import SliceOfFlowLicense from "./pages/SliceOfFlowLicense";

function SliceOfFlowRedirect() {
  return <Redirect to="/" replace />;
}

function Router() {
  return (
    // Wouter appends route paths to its base, so omit Vite's trailing slash.
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Switch>
        <Route path="/" component={SliceOfFlow} />
        <Route path="/license" component={SliceOfFlowLicense} />
        <Route path="/deck-shop" component={Home} />
        <Route path="/slice-of-flow" component={SliceOfFlowRedirect} />
        <Route path="/game" component={Game} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
