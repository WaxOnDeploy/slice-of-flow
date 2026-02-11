import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ConceptA from "./pages/ConceptA";
import ConceptB from "./pages/ConceptB";
import ConceptC from "./pages/ConceptC";
import JungleCruiseShop from "./pages/JungleCruiseShop";
import DorScorer from "./pages/DorScorer";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/concept-a"} component={ConceptA} />
      <Route path={"/concept-b"} component={ConceptB} />
      <Route path={"/concept-c"} component={ConceptC} />
      <Route path={"/jungle-cruise-shop"} component={JungleCruiseShop} />
      <Route path={"/dor-scorer"} component={DorScorer} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
