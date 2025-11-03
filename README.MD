## Fast web text

This is an experiment in text editor rendering to see how far the performance can be pushed while remaining accessible to screen readers.

A raw text file rendered on chrome tops out at 60FPS while scrolling.
<<<<<<< HEAD
<video src="https://github.com/user-attachments/assets/a9f96722-b109-45d8-92c9-edcfe6681df9">
||||||| dccbaa7
![Video](raw-text-60fps.mp4)
=======
<video src="public/raw-text-60fps.mp4" />
>>>>>>> fa1ffdbc76188dee602faf27f02c87b44353a299

We can push this to 100FPS when we create a shader and render directly on a canvas element
<<<<<<< HEAD
<video src="https://github.com/user-attachments/assets/41900e6d-48c2-4881-a45b-83200e159a74">
||||||| dccbaa7
![Video](public/canvas-100-fps.mp4)
=======
<video src="public/canvas-100-fps.mp4" />
>>>>>>> fa1ffdbc76188dee602faf27f02c87b44353a299

To achieve the above,
- Virtualized rendering of only the text that is in the window
- We use a custom shader
- The rendered glyphs for each character is cached
- Using a monospace font, so each character takes up the same amount of space, so pre-calculating and caching the position of each character.
- Parallel rendering of text in a hidden DOM element for screenreaders


### Add while keeping the same performance
- Add syntax highlighting
- Add editing
- Add cursor
- Add text selection
