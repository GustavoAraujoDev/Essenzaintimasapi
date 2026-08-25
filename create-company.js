const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const path = require("path");

const BcryptPasswordService = require(
  path.resolve(__dirname, "interfaces/http/security/BcryptPasswordService"),
);

// 🌟 IMPORTAÇÃO CORRETA: Importe o UserModel direto do arquivo que você acabou de me mandar
const { UserModel } = require(
  path.resolve(__dirname, "infra/repositories/UserRepositoryMongo"),
);

// (Faça o mesmo para Company e Membership se eles tiverem arquivos próprios, ou mantenha os genéricos abaixo APENAS se eles não tiverem schema estrito ainda)
const CompanyModel =
  mongoose.models.Company ||
  mongoose.model("Company", new mongoose.Schema({}, { strict: false }));
const MembershipModel =
  mongoose.models.Membership ||
  mongoose.model("Membership", new mongoose.Schema({}, { strict: false }));

async function rodarSeedDireto() {
  console.log("🔌 [1/3] Conectando ao MongoDB...");
  await mongoose.connect(
    "mongodb+srv://guguaraujo916_db_user:2iLrOJWD6Rgexjg9@guguaraujo.iedc8kv.mongodb.net/?appName=guguaraujo",
  );

  try {
    console.log("⚙️ [2/3] Gerando dados...");

    const emailDono = "admin@gustavoaraujo.com";
    const senhaLimpa = "Gu290901.";

    const usuarioExiste = await UserModel.findOne({ email: emailDono });
    if (usuarioExiste) {
      throw new Error(
        `O usuário com o e-mail ${emailDono} já está cadastrado no banco.`,
      );
    }

    const passwordService = new BcryptPasswordService();
    const passwordHash = await passwordService.hash(senhaLimpa);

    // 🌟 Gerando os UUIDs string que o seu projeto tanto ama e usa nas buscas
    const userId = randomUUID();
    const companyId = randomUUID();
    const membershipId = randomUUID();

    console.log("💾 Gravando documentos diretamente no banco de dados...");

    // 1. Criando o Usuário Admin (Deixando o Mongoose gerenciar o _id interno)
    await UserModel.create({
      id: userId, // 🌟 Aqui fica o UUID que o seu método 'doc.id.toString()' vai ler com sucesso!
      email: emailDono.toLowerCase().trim(),
      passwordHash: passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    });
    console.log(`✅ Usuário criado no Schema Real (ID: ${userId})`);

    // 2. Criando a Empresa
    await CompanyModel.create({
      id: companyId,
      name: "Pizzaria Suprema do Manoel",
      document: "12345678000199",
      email: "contato@pizzariasuprema.com",
      phone: "88999935987",
      status: "ACTIVE",
      plan: "FREE",
    });
    console.log(`✅ Empresa criada (ID: ${companyId})`);

    // 3. Criando o Vínculo (Membership) Owner
    await MembershipModel.create({
      id: membershipId,
      userId: userId, // Amarrado perfeitamente pelo UUID string
      companyId: companyId,
      role: "OWNER",
      status: "ACTIVE",
    });
    console.log(`✅ Vínculo de propriedade criado.`);

    console.log("\n🎉 SEED EXECUTADO COM SUCESSO!");
  } catch (error) {
    console.error("\n🚨 Falha ao executar o Seed Direto:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 [3/3] Conexão encerrada.");
  }
}

rodarSeedDireto();
