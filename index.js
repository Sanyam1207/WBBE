const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { GoogleGenerativeAI } = require("@google/generative-ai");

const server = http.createServer(app);

app.use(cors());
app.use(express.json())

let users = new Map()
let socketMap = new Map()
let elements = [];






const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});


io.on("connection", (socket) => {

  socket.on('join-room', ({ roomID, UserID }) => {
    socket.join(roomID)
    socket.userID = UserID;
  })

  io.to(socket.id).emit("whiteboard-state", { elements });

  socket.on("element-update", ({ elementData, roomID }) => {
    updateElementInElements(elementData);
    socket.broadcast.to(roomID).emit("element-update", elementData);
  });

  socket.on('student-sleeping', ({ userID, roomID }) => {
    socket.broadcast.to(roomID).emit('student-sleeping', userID)
  })

  socket.on('message', ({ userID, message, roomID, messageCopy }) => {
    socket.broadcast.to(roomID).emit('message', { userID, message, roomID, messageCopy })
  })

  socket.on('website-closed', ({ roomID, userID }) => {
    console.log(`User ${userID} closed website sharing in room: ${roomID}`);

    // Broadcast to all users in the room that the website was closed
    io.to(roomID).emit('website-closed', { userID, roomID });
  });


  socket.on('share-website', ({ websiteUrl, roomID, userID }) => {
    console.log(`User ${userID} is sharing website: ${websiteUrl} in room: ${roomID}`);

    // Validate URL (additional server-side validation)
    try {
      new URL(websiteUrl);

      // Broadcast the website URL to all users in the room except the sender
      socket.to(roomID).emit('website-shared', { websiteUrl, userID });

      // Also send confirmation back to the sender
      socket.emit('website-shared', { websiteUrl, userID });
    } catch (error) {
      console.error('Invalid URL format on server:', error);
      // Optionally notify the client about the error
      socket.emit('website-share-error', { error: 'Invalid URL format' });
    }
  });

  socket.on("whiteboard-clear", (roomID) => {
    elements = [];

    socket.broadcast.to(roomID).emit("whiteboard-clear");
  });

  socket.on("cursor-position", ({ cursorData, roomID }) => {
    socket.broadcast.to(roomID).emit("cursor-position", {
      ...cursorData,
      userId: socket.id,
    });
  });

  socket.on('quiz', ({ correctAnswer, roomID }) => {
    console.log(correctAnswer);

    socket.broadcast.to(roomID).emit('quiz', { correctAnswer })
  });

  socket.on('file', ({ roomID, fileName, fileType, fileData }) => {
    socket.to(roomID).emit('file-rechieved', (fileName, fileType, fileData))
  })

  socket.on('get-definition', async ({ question, userID }) => {
    console.log(question)
    const genAI = new GoogleGenerativeAI("AIzaSyC_JbJYfF9kBVeISyBMaWT7kkAvbOJMl6g");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Explain in simple words ${question}`;

    const result = await model.generateContent(prompt);
    const answer = result.response.text()
    console.log(result.response.text());
    console.log(userID)
    // socket.emit('got-definition', (answer))
    // Split the answer into words
    const words = answer.split(' ');
    let formattedAnswer = '';

    // Loop through the words and insert a newline after every 10 words
    for (let i = 0; i < words.length; i++) {
      // If we've reached a multiple of 10, add a newline before adding the word
      if (i > 0 && i % 10 === 0) {
        formattedAnswer += '\n';
      }
      formattedAnswer += words[i] + ' ';
    }

    // Trim any extra whitespace   at the end
    formattedAnswer = formattedAnswer.trim();

    socket.emit('got-definition', formattedAnswer);

  })


  socket.on('audioStream', ({ audioData, roomID }) => {
    socket.broadcast.to(roomID).emit('audioStream', { audioData });
  });


  socket.on("disconnect", () => {
    if (socket.roomID && socket.userID) {
      // Emit the disconnect event only to other users in the same room
      console.log("Diconnection event triggerrred")
      socket.broadcast.to(socket.roomID).emit("user-disconnected", { userID: socket.userID });
    }
  });
});

app.get("/", (req, res) => {
  res.send("Hello server is working");
});

app.post("/", (req, res) => {
  const { role, roomID, userID } = req.body
  tempRoomID = roomID
  console.log('role' + role);
  users.set(userID, { role: role, socketID: null })
})

const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  console.log("server is running on port", PORT);
});

const updateElementInElements = (elementData) => {
  const index = elements.findIndex((element) => element.id === elementData.id);

  if (index === -1) return elements.push(elementData);

  elements[index] = elementData;
};
