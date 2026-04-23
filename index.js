const admin = require("firebase-admin");

const serviceAccount = require("./eng-bd-elizeu-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

console.log("🔥 Listener de eventos ativo...");

db.collection("eventos").onSnapshot(snapshot => {

  if (snapshot.empty) return;

  snapshot.docChanges().forEach(async change => {

    try {
      if (change.type === "added") {

        const evento = change.doc.data();

        console.log("📩 Evento recebido:", evento);

        await processarEventoChamado(
          evento.chamado,
          evento.tipo
        );
      }

    } catch (err) {
      console.error("Erro processando evento:", err);
    }

  });

}, err => {
  console.error("Erro no listener Firestore:", err);
});