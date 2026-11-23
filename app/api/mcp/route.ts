import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import type { BirthFormState } from "@/components/BirthForm";
import { PROVINCES } from "@/lib/ziwei/cities";
import { formToBirthInfo } from "@/lib/ziwei/share";
import { generateChart } from "@/lib/ziwei/algorithm";

const mcpHandler = createMcpHandler(() => {
  const server = new McpServer({
    name: "ziwei-doushu",
    version: "1.0.0",
  });

  server.registerTool(
    "calculate_ziwei_chart",
    {
      description:
        "Tạo lá số Tử Vi theo bộ máy của repo ziwei-doushu. Hỏi người dùng ngày sinh dương lịch, giờ và phút theo giờ Bắc Kinh, giới tính, tỉnh và thành phố nơi sinh. Nếu không biết giờ sinh, đặt unknownTime=true. Không tự đoán thông tin còn thiếu.",
      inputSchema: z.object({
        year: z.number().int().min(1900).max(new Date().getFullYear()),
        month: z.number().int().min(1).max(12),
        day: z.number().int().min(1).max(31),
        clockHour: z.number().int().min(0).max(23).default(8),
        clockMinute: z.number().int().min(0).max(59).default(0),
        unknownTime: z.boolean().default(false),
        gender: z.enum(["male", "female"]),
        province: z.string().optional(),
        city: z.string().optional(),
        longitude: z.number().min(-180).max(180).optional(),
      }),
    },
    async (args) => {
      const province = args.province?.trim() ?? "";
      const city = args.city?.trim() ?? "";

      const provinceData = PROVINCES.find((item) => item.name === province);
      const cityData = provinceData?.cities.find((item) => item.name === city);
      const longitude = args.longitude ?? cityData?.longitude;

      if ((province || city) && longitude === undefined) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Không tìm thấy tỉnh/thành phố trong danh sách repo. Hãy cung cấp kinh độ hoặc bỏ trống cả tỉnh và thành phố.",
            },
          ],
        };
      }

      const form: BirthFormState = {
        name: "",
        year: String(args.year),
        month: String(args.month),
        day: String(args.day),
        clockHour: String(args.clockHour),
        clockMinute: String(args.clockMinute),
        unknownTime: args.unknownTime,
        province: longitude === undefined ? "" : province || "Tọa độ tùy chỉnh",
        city,
        longitude: longitude ?? 120,
        gender: args.gender,
      };

      try {
        const birthInfo = formToBirthInfo(form);
        const chart = generateChart(birthInfo);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(chart, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                error instanceof Error
                  ? error.message
                  : "Không thể lập lá số với thông tin đã nhập.",
            },
          ],
        };
      }
    },
  );

  return server;
});

async function handleMcpRequest(request: Request) {
  const token = process.env.MCP_ACCESS_TOKEN;

  if (!token) {
    return new Response("MCP_ACCESS_TOKEN chưa được cấu hình.", { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${token}`) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    });
  }

  return mcpHandler.fetch(request);
}

export const runtime = "nodejs";

export {
  handleMcpRequest as GET,
  handleMcpRequest as POST,
  handleMcpRequest as DELETE,
};
