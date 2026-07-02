# Use the lightweight Alpine Node image
FROM registry.access.redhat.com/hi/nodejs:latest-builder as builder

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

FROM registry.access.redhat.com/hi/nodejs:latest as final
COPY --from=builder /app /app
# OpenShift standard unprivileged port
EXPOSE 8080

# Start the application
CMD [ "npm", "start" ]
