const getProductsList = require("../lambda/getProductsList");

describe("getProductsList Lambda Function", () => {
  test("should return a list of products", async () => {
    const response = await getProductsList.handler();

    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    expect(body[0]).toHaveProperty("id");
    expect(body[0]).toHaveProperty("title");
    expect(body[0]).toHaveProperty("price");
  });
});
