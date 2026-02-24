import { GoogleGenAI } from "@google/genai";
import { Project, DetailedProject } from "../types";

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (aiInstance) return aiInstance;
  
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.warn("Gemini API Key is missing. AI features will be disabled.");
    return null;
  }
  
  aiInstance = new GoogleGenAI({ apiKey });
  return aiInstance;
};

export const generateExecutiveSummary = async (contextData: string): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Erro: API Key não configurada.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é um assistente executivo sênior de uma plataforma de TI chamada Teleinfo Nexus.
      
      Analise os seguintes dados brutos do sistema e forneça um resumo executivo de 1 parágrafo (max 50 palavras) em Português do Brasil.
      Foque em anomalias ou sucessos. Use formatação Markdown (negrito) para destaques.

      Dados:
      ${contextData}`,
      config: {
        temperature: 0.7,
      }
    });
    return response.text || "Não foi possível gerar o resumo.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao conectar com a IA.";
  }
};

export const generateProjectRiskAnalysis = async (project: Project): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Erro: API Key não configurada.";

  try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Você é um Gerente de Projetos Sênior da Teleinfo.
          Analise o seguinte projeto (linha de CSV) e identifique riscos potenciais, sugestões de ação e um breve status.
          Seja direto e profissional.
          
          Dados do Projeto:
          Cliente: ${project.CLIENTE}
          Tipo: ${project['TIPO DE PROJETO']}
          Produto: ${project['TIPO DE PRODUTO']}
          BU: ${project.BUs}
          Status Atual: ${project.STATUS}
          Progresso: ${project.perc}%
          
          Responda em Português do Brasil, formatado em HTML simples (sem tags html/body, apenas p, strong, ul, li).`,
          config: { temperature: 0.5 }
      });
      return response.text || "Análise indisponível.";
  } catch (error) {
      console.error(error);
      return "Erro ao gerar análise de risco.";
  }
};

export const generateDetailedProjectRiskAnalysis = async (project: DetailedProject): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Erro: API Key não configurada.";

  try {
      const soldTotal = Object.values(project.soldHours).reduce((a, b) => a + b, 0);
      const usedTotal = Object.values(project.usedHours).reduce((a, b) => a + b, 0);
      const hoursRatio = soldTotal > 0 ? (usedTotal / soldTotal * 100).toFixed(1) : 0;

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Atue como um Auditor de Projetos. Analise detalhadamente o projeto abaixo.
          
          Nome: ${project.name}
          Datas: ${project.start} até ${project.end}
          
          Etapas:
          ${project.steps.map(s => `- ${s.name}: ${s.perc}%`).join('\n')}
          
          Horas (Vendidas vs Utilizadas):
          - Infra: ${project.soldHours.infra} vs ${project.usedHours.infra}
          - Segurança: ${project.soldHours.sse} vs ${project.usedHours.sse}
          - TI: ${project.soldHours.ti} vs ${project.usedHours.ti}
          - Automação: ${project.soldHours.aut} vs ${project.usedHours.aut}
          
          Consumo Total de Horas: ${hoursRatio}% do orçamento.
          
          Forneça:
          1. Análise de Cronograma (está atrasado baseada na data de hoje: ${new Date().toLocaleDateString()}?)
          2. Análise Financeira/Horas (estourou orçamento em alguma BU?)
          3. Recomendações Críticas.
          
          Responda em Português do Brasil, formatado em HTML simples.`,
          config: { temperature: 0.5 }
      });
      return response.text || "Análise detalhada indisponível.";
  } catch (error) {
      console.error(error);
      return "Erro ao gerar análise detalhada.";
  }
};

export const generateSeniorPlanningAuditReport = async (project: DetailedProject): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Erro: API Key não configurada.";

  const calculateTimeProgress = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr);
    const end = new Date(endStr);
    const today = new Date();
    if (today < start) return 0;
    if (today > end) return 100;
    const total = end.getTime() - start.getTime();
    const elapsed = today.getTime() - start.getTime();
    return Math.min(100, Math.round((elapsed / total) * 100));
  };

  const timeProgress = calculateTimeProgress(project.start, project.end);
  const avgExec = project.steps.length > 0 ? project.steps.reduce((acc, s) => acc + s.perc, 0) / project.steps.length : 0;

  const prompt = `Engenheiro AI Planejamento Sênior, Especialista em Custos e Auditor de Obras. Sua função é analisar os indicadores de um projeto de engenharia/tecnologia e emitir um relatório técnico gerencial. O foco é cruzar os dados de prazo (tempo decorrido), avanço físico da obra e o consumo de Horas-Homem (H/H) em três frentes: Infraestrutura, Segurança e Tecnologia.

**Fator Crítico de Auditoria:**
Considere que, historicamente neste projeto, **80% dos atrasos e do consumo excedente de H/H são decorrentes de inclusões de trabalho fora do escopo original (Extra-Escopo)**.

Dados do Projeto:
Projeto: ${project.name}
Centro de Custo / BU: ${project.costCenter} / ${project.bu}
Período: ${project.start} a ${project.end}
Tempo de Cronograma Decorrido: ${timeProgress}%
Avanço Físico Total (Fases): ${avgExec.toFixed(2)}%

Gestão de H/H (Vendida vs. Utilizada):
Infraestrutura: Vendida = ${project.soldHours.infra} | Utilizada = ${project.usedHours.infra}
Segurança (SEC): Vendida = ${project.soldHours.sse} | Utilizada = ${project.usedHours.sse}
Tecnologia (TI): Vendida = ${project.soldHours.ti} | Utilizada = ${project.usedHours.ti}

Sua Tarefa:
Analise os dados fornecidos e gere um Relatório de Auditoria estruturado em formato Markdown, contendo obrigatoriamente as seguintes seções:

1. Parecer Técnico Geral
Avalie a saúde geral do projeto comparando o Tempo Decorrido com o Avanço Físico. Diga claramente se a obra está adiantada, atrasada ou dentro do cronograma, apontando o nível de criticidade.

2. Análise de Desempenho de H/H e Impacto de Escopo
Avalie o consumo de horas de cada disciplina. Atribua o desvio encontrado ao fator de **80% de trabalho fora do escopo**. Destaque o impacto financeiro e operacional dessa variação.

3. Projeção do H/H Ideal e Sugestão de Aditivo
Com base no Avanço Físico atual (${avgExec.toFixed(2)}%), estime o limite "ideal" de horas para o escopo original. Em seguida, **calcule e sugira explicitamente o volume de horas adicionais que deve ser cobrado em uma proposta de aditivo** para cobrir os 80% de desvios por extra-escopo, visando a saúde financeira do contrato.

4. Sugestões e Plano de Ação
Liste de 3 a 4 recomendações práticas para regularizar o contrato (ex: formalização de aditivos, controle rígido de escopo) e para manter o bom desempenho técnico.

Diretrizes de Estilo:
Seja analítico, direto e profissional. Use negrito para destacar números, alertas e a sugestão de cobrança adicional.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { temperature: 0.4 }
    });
    return response.text || "Relatório de auditoria indisponível.";
  } catch (error) {
    console.error(error);
    return "Erro ao gerar relatório de auditoria sênior.";
  }
};