import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";

export class AuthorizationServiceStack extends cdk.Stack {
    public readonly authorizerLambda: lambda.Function;

    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Define Lambda function for authorization
        this.authorizerLambda = new lambda.Function(this, "BasicAuthorizer", {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "basicAuthorizer.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "../lambda")),
            environment: {
                GITHUB_USERNAME: process.env.GITHUB_USERNAME || "",
                TEST_PASSWORD: process.env.TEST_PASSWORD || "TEST_PASSWORD"
            }
        });

        // Output Lambda ARN to reference it in another stack
        new cdk.CfnOutput(this, "AuthorizerLambdaArn", {
            value: this.authorizerLambda.functionArn,
            exportName: "AuthorizerLambdaArn",
        });
    }
}
