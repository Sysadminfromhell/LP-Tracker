

# Installation



LP-Tracker supports container-based deployment.



## Requirements



\- Docker Engine

\- PostgreSQL

\- Reverse proxy with HTTPS

\- Access to a supported League data provider



## Container Images



The official images are available on Docker Hub:



```bash

docker pull safhdev/lp-tracker:frontend

docker pull safhdev/lp-tracker:backend

```



If you want to test the latest changes you are invited to use the staging-environment:



```bash

docker pull safhdev/lp-tracker:frontend-staging

docker pull safhdev/lp-tracker:backend-staging

```





## Configuration



Backend configuration is provided through environment variables.



See `backend/.env.example` in the GitHub repository for the available settings.



## Next Steps



Configure PostgreSQL, your reverse proxy and the League data provider before starting the application.



