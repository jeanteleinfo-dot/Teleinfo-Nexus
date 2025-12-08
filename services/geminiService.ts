import { GoogleGenAI } from "@google/genai";
import { Project, DetailedProject } from "../types";

const apiKey = process.env.API_KEY || '';
// Initialize safe instance, handle missing key gracefully in UI
const ai = new GoogleGenAI({ apiKey });

export const generateExecutiveSummary = async (contextData: string): Promise<string> => {
  if (!apiKey) return "Erro: API Key não configurada.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
  if (!apiKey) return "Erro: API Key não configurada.";

  try {
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
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
  if (!apiKey) return "Erro: API Key não configurada.";

  try {
      const soldTotal = Object.values(project.soldHours).reduce((a, b) => a + b, 0);
      const usedTotal = Object.values(project.usedHours).reduce((a, b) => a + b, 0);
      const hoursRatio = soldTotal > 0 ? (usedTotal / soldTotal * 100).toFixed(1) : 0;

      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
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