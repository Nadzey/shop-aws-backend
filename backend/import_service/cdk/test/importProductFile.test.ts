import { APIGatewayProxyEvent } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { handler } from "../../lambda/importProductsFile";

// Mock modules
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  PutObjectCommand: jest.fn().mockImplementation((params) => ({
    ...params,
    command: 'PutObject'
  }))
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn()
}));

describe("importProductsFile Lambda", () => {
  const mockS3Client = new S3Client({});
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BUCKET_NAME = "XXXXXXXXXXX";
  });

  it("should return 400 when filename is missing", async () => {
    const mockEvent = {
      queryStringParameters: {}
    } as APIGatewayProxyEvent;

    const response = await handler(mockEvent);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: "Missing 'name' query parameter"
    });
  });

  it("should return 400 when queryStringParameters is null", async () => {
    const mockEvent = {} as APIGatewayProxyEvent;

    const response = await handler(mockEvent);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: "Missing 'name' query parameter"
    });
  });

  it("should return 500 when S3 signing fails", async () => {
    (getSignedUrl as jest.Mock).mockRejectedValue(new Error("S3 Error"));

    const mockEvent: APIGatewayProxyEvent = {
        queryStringParameters: {
            name: "test.csv"
        }
    } as unknown as APIGatewayProxyEvent;    

    const response = await handler(mockEvent);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      error: "S3 Error"
    });
  });

  it("should include CORS headers in the response", async () => {
    (getSignedUrl as jest.Mock).mockResolvedValue("https://test-signed-url.com");

    const mockEvent: APIGatewayProxyEvent = {
        queryStringParameters: {
            name: "test.csv"
        }
    } as unknown as APIGatewayProxyEvent;    

    const response = await handler(mockEvent);

    expect(response.headers).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type"
    });
  });

  it("should include CORS headers in error responses", async () => {
    const mockEvent = {
      queryStringParameters: {}
    } as APIGatewayProxyEvent;

    const response = await handler(mockEvent);

    expect(response.headers).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type"
    });
  });
});
