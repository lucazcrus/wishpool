import logoSrc from './assets/images/Logo-App.svg'

const sections = [
  {
    title: '1. Informações que coletamos',
    body:
      'O Bag pode coletar dados fornecidos por você ao criar uma conta, como nome e email, além de informações necessárias para o funcionamento da extensão e do app, como links salvos, categorias e metadados básicos da página ativa, incluindo URL, título e favicon.',
  },
  {
    title: '2. Como usamos essas informações',
    body:
      'Usamos esses dados exclusivamente para permitir login, salvar links, organizar produtos em listas e categorias, sincronizar sua conta entre app e extensão e melhorar a experiência de uso do Bag.',
  },
  {
    title: '3. Compartilhamento de dados',
    body:
      'O Bag não vende dados pessoais. As informações podem ser processadas por prestadores essenciais ao serviço, como Supabase para autenticação e banco de dados, Resend para emails transacionais e provedores de infraestrutura para hospedagem e funcionamento da plataforma.',
  },
  {
    title: '4. Armazenamento e segurança',
    body:
      'Adotamos medidas razoáveis de segurança para proteger seus dados. Parte das informações também pode ser armazenada localmente no navegador ou na extensão para viabilizar recursos como autenticação, categorias e filas temporárias de sincronização.',
  },
  {
    title: '5. Seus direitos',
    body:
      'Você pode solicitar atualização ou exclusão das suas informações pessoais a qualquer momento. Para isso, entre em contato pelo email informado na própria comunicação oficial do Bag ou pelos canais de suporte disponíveis.',
  },
  {
    title: '6. Alterações nesta política',
    body:
      'Esta Política de Privacidade pode ser atualizada periodicamente para refletir mudanças no produto, exigências legais ou melhorias operacionais. Recomendamos consultar esta página sempre que necessário.',
  },
]

export default function PrivacyApp() {
  return (
    <div className="min-h-screen bg-white text-black" style={{ fontFamily: 'Inter, sans-serif' }}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 md:px-6 md:py-14">
        <header className="flex flex-col gap-5 border-b border-[#eee] pb-8">
          <a href="./landing.html" className="w-fit" aria-label="Voltar para a landing do Bag">
            <img src={logoSrc} alt="Bag" className="h-8 w-auto" />
          </a>
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#FC4E23]">
              Política de Privacidade
            </p>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
              Como o Bag coleta, usa e protege suas informações
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[rgba(0,0,0,0.6)]">
              Esta página explica quais dados são utilizados para viabilizar o app e a extensão do
              Bag, como essas informações são tratadas e quais são os princípios que seguimos para
              manter sua privacidade.
            </p>
          </div>
        </header>

        <section className="flex flex-col gap-6">
          {sections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-[#eee] p-6 md:p-7">
              <h2 className="text-lg font-semibold md:text-xl">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[rgba(0,0,0,0.72)] md:text-base">
                {section.body}
              </p>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
