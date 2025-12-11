import { Routes, Route } from "react-router";
import { Button, HStack } from "@chakra-ui/react";
import Home from "./components/Home";
import About from "./components/About";

function App() {
  return (
    <>
      <div>Hello from Vite + React</div>
      <HStack>
        <Button>Click Me</Button>
      </HStack>
      <Routes>
        <Route path="/" element={<Home />}></Route>
        <Route path="/about" element={<About />}></Route>
      </Routes>
    </>
  );
}

export default App;
