// express-async-errors не публикует типов — модуль используется только для побочного эффекта
// (патчит express.Router, чтобы rejected promise из async-хендлера доходил до error middleware).
declare module "express-async-errors";
